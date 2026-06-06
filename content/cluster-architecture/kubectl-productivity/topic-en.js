window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cluster-architecture/kubectl-productivity'] = {
  theory: `# kubectl: Speed, JSONPath & Output

## Exam Relevance
> The CKA/CKAD are **timed**, 100% hands-on exams. Whoever writes YAML from scratch loses. The difference between passing and not finishing is in: generating manifests with \`--dry-run=client -o yaml\`, extracting data with **JSONPath**, sorting/formatting output and mastering imperative commands. This topic is about **saving minutes** on every question.

## Time-saving setup (do this first)

\`\`\`bash
# Universal alias
alias k=kubectl

# Autocompletion (bash)
source <(kubectl completion bash)
complete -o default -F __start_kubectl k

# Variable for the "do" (dry-run + yaml) — generate manifests fast
export do="--dry-run=client -o yaml"

# Variable for fast deletion without waiting
export now="--force --grace-period=0"

# Switch namespace without typing -n every time
kubectl config set-context --current --namespace=<ns>
\`\`\`

> With this, \`k run nginx --image=nginx $do\` spits out a manifest ready to edit. On the exam, edit from the generated output instead of writing from scratch.

## Imperative vs Declarative

| Approach | Command | When |
|----------|---------|------|
| Imperative | \`kubectl create/run/expose ...\` | Fast; simple objects |
| Imperative → YAML | \`... --dry-run=client -o yaml > f.yaml\` | Generate a base and edit |
| Declarative | \`kubectl apply -f f.yaml\` | Complex objects; idempotent |

> **Exam golden rule:** generate with imperative, refine only the missing YAML, apply with \`apply\`.

## Imperative generators (memorize the main ones)

\`\`\`bash
# Pod
kubectl run nginx --image=nginx
kubectl run busybox --image=busybox --restart=Never --command -- sleep 3600
kubectl run tmp --image=busybox --rm -it --restart=Never -- sh   # throwaway pod

# Deployment
kubectl create deployment web --image=nginx --replicas=3

# Job and CronJob
kubectl create job hello --image=busybox -- echo hi
kubectl create cronjob nightly --image=busybox --schedule="0 2 * * *" -- echo run

# Service (expose a Deployment/Pod)
kubectl expose deployment web --port=80 --target-port=8080
kubectl expose pod nginx --port=80 --name=nginx-svc --type=NodePort

# ConfigMap and Secret
kubectl create configmap app-cfg --from-literal=KEY=val --from-file=./config.txt
kubectl create secret generic db --from-literal=password=s3cr3t

# RBAC
kubectl create serviceaccount ci
kubectl create role reader --verb=get,list,watch --resource=pods
kubectl create rolebinding ci-reader --role=reader --serviceaccount=default:ci

# Namespace and ResourceQuota
kubectl create namespace dev
kubectl create quota q --hard=cpu=2,memory=2Gi,pods=10 -n dev
\`\`\`

## Edit existing objects (without rewriting YAML)

\`\`\`bash
kubectl set image deployment/web nginx=nginx:1.25
kubectl set resources deployment/web --limits=cpu=500m,memory=256Mi
kubectl set env deployment/web LOG_LEVEL=debug
kubectl scale deployment/web --replicas=5
kubectl label pod nginx tier=frontend
kubectl annotate pod nginx owner=team-a
kubectl patch deployment web -p '{"spec":{"replicas":4}}'
kubectl edit deployment web            # opens the editor (use carefully with time)
\`\`\`

## Output formats (-o)

\`\`\`bash
kubectl get pods                    # default table
kubectl get pods -o wide            # + node, IP
kubectl get pod nginx -o yaml       # full manifest
kubectl get pod nginx -o json
kubectl get pods -o name            # pod/nginx pod/web... (great for scripts)
kubectl get pods --no-headers       # no header
\`\`\`

## JSONPath (the speed differentiator)

JSONPath extracts specific fields without grep/awk. Syntax: \`-o jsonpath='{...}'\`.

\`\`\`bash
# Single field
kubectl get pod nginx -o jsonpath='{.status.podIP}'

# All names (implicit range with [*])
kubectl get pods -o jsonpath='{.items[*].metadata.name}'

# One line per item (explicit range)
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.phase}{"\\n"}{end}'

# Images of all pods
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'

# Filter: node name of each pod
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{" -> "}{.spec.nodeName}{"\\n"}{end}'

# Filter by condition [?(@.field=="value")]
kubectl get nodes -o jsonpath='{.items[?(@.spec.unschedulable)].metadata.name}'

# kubelet version per node
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.kubeletVersion}'
\`\`\`

> Useful tokens: \`{range}...{end}\` to iterate, \`{"\\n"}\`/\`{"\\t"}\` for separators, \`[?(@.x=="y")]\` to filter.

## custom-columns (tailored table)

\`\`\`bash
kubectl get pods -o custom-columns=\\
NAME:.metadata.name,NODE:.spec.nodeName,PHASE:.status.phase

kubectl get pods -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[*].image'
\`\`\`

## --sort-by (sort results)

\`\`\`bash
# Pods by restart count (find the most unstable)
kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'

# Events by timestamp
kubectl get events --sort-by='.lastTimestamp'

# Nodes by CPU capacity
kubectl get nodes --sort-by='.status.capacity.cpu'
\`\`\`

## Selectors: labels and fields

\`\`\`bash
# By label
kubectl get pods -l app=web
kubectl get pods -l 'env in (prod,staging)'
kubectl get pods -l '!canary'                 # those WITHOUT the canary label

# By field
kubectl get pods --field-selector status.phase=Running
kubectl get pods --field-selector spec.nodeName=node-1
kubectl get events --field-selector type=Warning
\`\`\`

## kubectl explain (docs without leaving the terminal)

\`\`\`bash
kubectl explain pod.spec.containers
kubectl explain deployment.spec.strategy --recursive   # full field tree
kubectl explain pvc.spec.resources
\`\`\`

> On the exam you have no docs website, but you have \`kubectl explain\`. Use it to recall the exact structure of a field.

## Resource discovery

\`\`\`bash
kubectl api-resources                          # all kinds + shortnames + apiGroup
kubectl api-resources --namespaced=true        # namespaced only
kubectl api-versions                           # available API versions
kubectl explain <resource> | head -3           # correct apiVersion/kind
\`\`\`

## Watch and compare

\`\`\`bash
kubectl get pods -w                 # watch (follow changes)
kubectl get pods -A                 # all namespaces
kubectl diff -f f.yaml              # what apply would change
kubectl rollout status deploy/web   # wait for the rollout to finish
\`\`\`

## Vim tip for the exam (YAML)

Add to \`~/.vimrc\` at the start of the exam to avoid indentation pain:

\`\`\`
set tabstop=2 shiftwidth=2 expandtab
\`\`\`

## Common Mistakes

1. **Writing YAML from scratch** when \`$do\` (\`--dry-run=client -o yaml\`) would generate the base in seconds.
2. **\`--dry-run\` without \`=client\`** — in newer versions the default changed; be explicit (\`=client\`).
3. **Forgetting \`{range}{end}\`** in JSONPath and seeing everything on one line.
4. **Confusing label selector (\`-l\`) with field selector (\`--field-selector\`)** — fields are limited (few supported, e.g. \`status.phase\`, \`spec.nodeName\`).
5. **Using \`kubectl edit\`** for big changes under pressure — set/patch are usually faster and less prone to indentation errors.
6. **Not switching the context namespace** and typing \`-n\` on every command.

## Killer.sh Style Challenge

> Without writing YAML by hand:
>
> 1. Generate (without applying) the manifest of a Deployment \`api\` with image \`nginx:1.25\` and 3 replicas, saving to \`api.yaml\`.
> 2. List all pods in namespace \`kube-system\` sorted by restart count.
> 3. Extract, one line per pod, the name and nodeName of all pods in \`kube-system\` using JSONPath.
> 4. Show a custom-columns table with NAME and IMAGE of the \`kube-system\` pods.
>
> Hint: \`k create deployment api --image=nginx:1.25 --replicas=3 $do > api.yaml\`; \`--sort-by\`; \`-o jsonpath='{range .items[*]}...{end}'\`; \`-o custom-columns=...\`.
`,

  quiz: [
    {
      question: 'What is the fastest way to get a base YAML manifest of a Deployment without writing it by hand or creating the object in the cluster?',
      options: [
        "kubectl get deployment web -o yaml",
        "kubectl create deployment web --image=nginx --dry-run=client -o yaml",
        "kubectl apply -f deployment.yaml",
        "kubectl explain deployment"
      ],
      correct: 1,
      explanation: 'kubectl create ... --dry-run=client -o yaml generates the manifest WITHOUT sending it to the cluster (client-side) and prints the YAML ready to edit/save. get -o yaml only works for an already existing object; apply actually creates it; explain only shows field documentation.',
      reference: 'Section Imperative vs Declarative and Setup ($do variable).'
    },
    {
      question: 'You need one line per pod with name and phase. Which JSONPath produces that?',
      options: [
        "-o jsonpath='{.items[*].metadata.name}'",
        "-o jsonpath='{range .items[*]}{.metadata.name}{\"\\t\"}{.status.phase}{\"\\n\"}{end}'",
        "-o custom-columns=NAME:.metadata.name",
        "-o name"
      ],
      correct: 1,
      explanation: 'The {range .items[*]}...{end} block iterates item by item, and {\"\\t\"}/{\"\\n\"} insert separators and a line break. Without range, .items[*] puts everything on a single line. custom-columns would also produce the table, but the question asks for JSONPath.',
      reference: 'Section JSONPath — use of {range}{end} and separators.'
    },
    {
      question: 'Which command quickly finds the pod with the HIGHEST restart count?',
      options: [
        "kubectl get pods -o wide",
        "kubectl get pods --field-selector status.phase=Running",
        "kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'",
        "kubectl get pods -l restarts=high"
      ],
      correct: 2,
      explanation: '--sort-by takes a JSONPath path and sorts the output by it. Sorting by .status.containerStatuses[0].restartCount puts the most unstable pod at the end of the list. field-selector filters by phase (does not sort by restart); labels do not reflect restarts automatically.',
      reference: 'Section --sort-by.'
    },
    {
      question: 'What is the difference between "-l app=web" and "--field-selector spec.nodeName=node-1"?',
      options: [
        "They are synonyms; both filter by label",
        "-l filters by LABELS (metadata.labels); --field-selector filters by object FIELDS, and only some fields are supported",
        "--field-selector is slower but supports any field",
        "-l only works with Deployments"
      ],
      correct: 1,
      explanation: 'The label selector (-l) matches against metadata.labels and supports operators (in, notin, !). The field-selector matches against actual object fields (e.g. status.phase, spec.nodeName, metadata.namespace), but the set of supported fields is limited per resource. Confusing the two is a common mistake.',
      reference: 'Section Selectors: labels and fields + Common Mistakes (item 4).'
    },
    {
      question: 'During the exam you do not recall the exact structure of "pod.spec.containers". How do you find it without internet access?',
      options: [
        "kubectl describe pod",
        "kubectl api-resources",
        "kubectl explain pod.spec.containers (optionally --recursive)",
        "kubectl get pod -o yaml of any pod"
      ],
      correct: 2,
      explanation: 'kubectl explain shows field documentation directly from the API server, including types and descriptions. With --recursive it prints the full field tree. It is the official offline source during the exam. api-resources lists kinds, not the field structure.',
      reference: 'Section kubectl explain.'
    },
    {
      question: 'What does "export do=\'--dry-run=client -o yaml\'" combined with "k run nginx --image=nginx $do" do?',
      options: [
        "Creates the nginx pod immediately in the cluster",
        "Prints the pod YAML manifest without creating it, allowing redirection to a file",
        "Validates the pod on the server (server-side) and creates it if valid",
        "Applies the pod and shows the diff"
      ],
      correct: 1,
      explanation: 'The $do variable expands to --dry-run=client -o yaml, so the command generates the YAML locally (without touching the cluster) and prints it. It is the classic exam shortcut: k run/create ... $do > file.yaml to then edit and apply.',
      reference: 'Section Time-saving setup.'
    },
    {
      question: 'Which output is ideal for feeding the result of "kubectl get" into another command in a script (e.g. delete several)?',
      options: [
        "-o wide",
        "-o yaml",
        "-o name (e.g. pod/nginx pod/web)",
        "--no-headers alone"
      ],
      correct: 2,
      explanation: '-o name produces identifiers in the type/name format (pod/nginx), which can be passed directly to another kubectl (e.g. kubectl delete $(kubectl get pods -l x=y -o name)). It is more robust than slicing text columns with awk.',
      reference: 'Section Output formats (-o).'
    }
  ],

  flashcards: [
    {
      front: 'Speed setup at the start of the exam (alias, completion, $do)',
      back: '```bash\nalias k=kubectl\nsource <(kubectl completion bash)\ncomplete -o default -F __start_kubectl k\nexport do="--dry-run=client -o yaml"\nexport now="--force --grace-period=0"\nkubectl config set-context --current --namespace=<ns>\n```\n\nThen: `k run nginx --image=nginx $do > pod.yaml` to generate and edit.'
    },
    {
      front: 'Essential imperative generators',
      back: '```bash\nk run pod --image=nginx\nk create deployment web --image=nginx --replicas=3\nk create job j --image=busybox -- echo hi\nk create cronjob c --image=busybox --schedule="*/5 * * * *" -- date\nk expose deploy web --port=80 --target-port=8080\nk create configmap cm --from-literal=K=V\nk create secret generic s --from-literal=p=123\nk create role r --verb=get,list --resource=pods\n```'
    },
    {
      front: 'JSONPath: single field, list and one line per item',
      back: '```bash\n# single field\n-o jsonpath=\'{.status.podIP}\'\n\n# all names (one line)\n-o jsonpath=\'{.items[*].metadata.name}\'\n\n# one line per item\n-o jsonpath=\'{range .items[*]}{.metadata.name}{"\\t"}{.status.phase}{"\\n"}{end}\'\n\n# filter by condition\n-o jsonpath=\'{.items[?(@.spec.unschedulable)].metadata.name}\'\n```'
    },
    {
      front: 'custom-columns vs --sort-by',
      back: '**custom-columns** — tailored table:\n```bash\nk get pods -o custom-columns=\\\nNAME:.metadata.name,NODE:.spec.nodeName\n```\n\n**--sort-by** — sorts by a JSONPath:\n```bash\nk get pods --sort-by=\'.status.containerStatuses[0].restartCount\'\nk get events --sort-by=\'.lastTimestamp\'\n```'
    },
    {
      front: 'Label selector vs field selector',
      back: '**-l (label)** — matches metadata.labels, supports operators:\n```bash\nk get pods -l app=web\nk get pods -l \'env in (prod,staging)\'\nk get pods -l \'!canary\'\n```\n\n**--field-selector** — matches object fields (limited set):\n```bash\nk get pods --field-selector status.phase=Running\nk get pods --field-selector spec.nodeName=node-1\n```'
    },
    {
      front: 'How to edit objects without rewriting YAML?',
      back: '```bash\nk set image deploy/web nginx=nginx:1.25\nk set resources deploy/web --limits=cpu=500m\nk set env deploy/web LOG=debug\nk scale deploy/web --replicas=5\nk label pod nginx tier=frontend\nk patch deploy web -p \'{"spec":{"replicas":4}}\'\n```\n\nFaster and safer than `kubectl edit` under pressure.'
    },
    {
      front: 'kubectl explain and resource discovery',
      back: '```bash\nk explain pod.spec.containers\nk explain deploy.spec.strategy --recursive\nk api-resources              # kinds + shortnames + group\nk api-resources --namespaced=true\nk api-versions               # API versions\n```\n\n`explain` is the official **offline** docs during the exam.'
    }
  ],

  lab: {
    scenario: 'Practice the imperative manifest-generation flow and data extraction with JSONPath, custom-columns and --sort-by, the way it accelerates the exam.',
    objective: 'Build muscle memory to generate resources quickly and query the cluster without writing YAML from scratch.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Setup and imperative manifest generation',
        instruction: 'Configure the alias and the $do variable, then generate (without applying) Pod, Deployment and Service manifests.',
        hints: ['export do="--dry-run=client -o yaml"', 'Redirect the output to files'],
        solution: `\`\`\`bash
alias k=kubectl
export do="--dry-run=client -o yaml"

# Generate manifests WITHOUT creating in the cluster
k run nginx --image=nginx $do > pod.yaml
k create deployment web --image=nginx --replicas=3 $do > deploy.yaml
k create job hello --image=busybox $do -- echo hi > job.yaml

# Check the generated content
head -15 deploy.yaml

# Now actually apply (for real) for the next steps
kubectl create deployment web --image=nginx --replicas=3
kubectl create deployment api --image=nginx --replicas=2
\`\`\``,
        verify: `\`\`\`bash
ls pod.yaml deploy.yaml job.yaml
# Expected: the 3 generated files

kubectl get deploy
# Expected: web (3) and api (2) created
\`\`\``
      },
      {
        title: 'Output and selectors',
        instruction: 'Explore -o wide/name, label and field selectors to locate pods quickly.',
        hints: ['-o name is great for pipelines', '--field-selector has limited fields'],
        solution: `\`\`\`bash
kubectl get pods -o wide
kubectl get pods -o name
kubectl get pods --no-headers | wc -l

# By label (deployments create the label app=<name>)
kubectl get pods -l app=web

# By field
kubectl get pods --field-selector status.phase=Running
kubectl get pods --field-selector spec.nodeName=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -l app=web --no-headers | wc -l
# Expected: 3 (replicas of the web deployment)

kubectl get pods -o name | head
# Expected: lines in the pod/web-xxxx format
\`\`\``
      },
      {
        title: 'JSONPath, custom-columns and --sort-by',
        instruction: 'Extract name+node per pod with JSONPath, build a custom-columns table and sort by restarts.',
        hints: ['{range .items[*]}...{end}', '--sort-by takes a JSONPath path'],
        solution: `\`\`\`bash
# One line per pod: name -> node
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{" -> "}{.spec.nodeName}{"\\n"}{end}'

# Tailored table
kubectl get pods -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,PHASE:.status.phase

# Sort by restart count
kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'

# Images of all pods
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'

# kubelet version per node
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.nodeInfo.kubeletVersion}{"\\n"}{end}'
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName --no-headers | head
# Expected: NAME and NODE columns filled

# Cleanup
kubectl delete deployment web api
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: '--dry-run command creates the object instead of just printing the YAML',
      difficulty: 'easy',
      symptom: 'You ran a create expecting to only see the YAML, but the object was actually created in the cluster.',
      diagnosis: `\`\`\`bash
# Likely: missing =client on dry-run, or missing -o yaml
kubectl create deployment x --image=nginx --dry-run -o yaml   # ambiguous in old versions
\`\`\``,
      solution: `**Cause:** \`--dry-run\` without the explicit mode. In modern versions the correct form is \`--dry-run=client\` (local validation/generation, does not touch the cluster). \`--dry-run=server\` sends it to the server to validate (but also does not persist).

\`\`\`bash
# Correct form
kubectl create deployment x --image=nginx --dry-run=client -o yaml

# If the object was created by mistake:
kubectl delete deployment x
\`\`\`

**Prevention:** standardize with the variable \`export do="--dry-run=client -o yaml"\` and always use \`$do\`.`
    },
    {
      title: 'JSONPath prints everything on a single line',
      difficulty: 'easy',
      symptom: 'The -o jsonpath output glues all values together without line breaks, making it hard to read.',
      diagnosis: `\`\`\`bash
# Without range, [*] concatenates everything
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
# pod1 pod2 pod3 (single line)
\`\`\``,
      solution: `**Cause:** using \`{.items[*]...}\` without the \`{range}...{end}\` block, which is responsible for iterating and allowing per-item separators.

\`\`\`bash
# One line per item with explicit \\n
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\\n"}{end}'

# With more fields and tab
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.phase}{"\\n"}{end}'
\`\`\`

**Alternative:** when you only want a readable table, \`-o custom-columns=...\` is usually simpler than JSONPath.`
    }
  ]
};
