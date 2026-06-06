window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-advanced/cilium-egress-gateway'] = {
  theory: `# Cilium Egress Gateway: Stable Egress IP

## Relevance
> Legacy external systems — firewalls, databases, SaaS APIs — frequently **allowlist by source IP**. But Pod IPs are **ephemeral** and change on every reschedule. Cilium **Egress Gateway** solves this by routing the egress traffic of selected Pods through a gateway node, applying **SNAT** to a **fixed, predictable IP**. It is a classic enterprise requirement (integration with the "outside world").

## The problem

\`\`\`
Without Egress Gateway:
  Pod (IP 10.0.3.47)  ----->  SNAT by the node it landed on  ----->  External firewall
  Rescheduled Pod     ----->  another node, another IP        ----->  BLOCKED (IP not allowlisted)

With Egress Gateway:
  Selected Pods       ----->  gateway node (SNAT to 192.0.2.10)  ----->  Firewall (allowlist 192.0.2.10) OK
\`\`\`

Without a stable egress IP, you would have to allowlist the entire node range on the firewall — insecure and fragile.

## Prerequisites

The Egress Gateway depends on the eBPF masquerading datapath:

\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set egressGateway.enabled=true \\
  --set kubeProxyReplacement=true \\
  --set bpf.masquerade=true

kubectl -n kube-system rollout restart ds/cilium
\`\`\`

> Requires **kube-proxy replacement** and **BPF masquerade** enabled. Without them, the policy has no effect.

## CiliumEgressGatewayPolicy

The CRD selects **which Pods**, to **which destinations**, should leave via **which gateway/IP**.

\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumEgressGatewayPolicy
metadata:
  name: db-egress
spec:
  # 1. Which Pods? (by namespace/labels)
  selectors:
    - podSelector:
        matchLabels:
          app: payments
          io.kubernetes.pod.namespace: production
  # 2. To which external destinations?
  destinationCIDRs:
    - "203.0.113.0/24"          # legacy database network
  # 3. Via which gateway and with which egress IP?
  egressGateway:
    nodeSelector:
      matchLabels:
        egress-node: "true"     # node(s) marked as gateway
    egressIP: "192.0.2.10"       # fixed IP the external world will see (SNAT)
\`\`\`

\`\`\`bash
# Mark the gateway node
kubectl label node node-egress-1 egress-node=true

kubectl apply -f db-egress.yaml
\`\`\`

### The 3 ingredients of the policy
| Field | Defines |
|-------|---------|
| \`selectors.podSelector\` | which source Pods |
| \`destinationCIDRs\` | which external networks the rule applies to |
| \`egressGateway.nodeSelector\` + \`egressIP\` | which node to leave from and with which IP (SNAT) |

> Only traffic from the selected Pods **destined to the listed CIDRs** is diverted through the gateway. Everything else leaves normally. This avoids creating a chokepoint for all traffic.

## Validating

\`\`\`bash
# 1. From the selected Pod, hit a service that echoes the source IP
kubectl exec -n production deploy/payments -- curl -s https://ifconfig.me
# Expected: 192.0.2.10 (the egressIP), not the node IP

# 2. View the egress mapping in the Cilium agent
kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list

# 3. Check the policy
kubectl get ciliumegressgatewaypolicy db-egress -o yaml
\`\`\`

## High availability

The gateway node is a passthrough point. If it goes down, traffic diverted to the CIDRs stops. Strategies:

- **Multiple gateway nodes** with the same label and an \`egressIP\` that can float (an externally managed VIP, e.g. via cloud or keepalived).
- Recent Cilium versions support **egress gateway HA** (failover between eligible nodes).
- Monitor the gateway node health and alert — the failure is silent from the Pod perspective (just timeouts for that destination).

## When to use (and when not)

| Use | Do not use |
|-----|-----------|
| Integrate with a firewall/SaaS that filters by source IP | For all cluster egress traffic |
| Give a stable IP to a specific set of Pods | When the destination does not care about the source IP |
| Compliance that requires a predictable source | As a replacement for NetworkPolicy (they are different) |

## Common Mistakes

1. **Forgetting the prerequisites** (kube-proxy replacement + bpf.masquerade) — the policy has no effect.
2. **No node with the nodeSelector label** — without an eligible gateway, traffic is not diverted.
3. **destinationCIDRs too broad** (e.g. 0.0.0.0/0) — sends ALL egress through the gateway, creating a chokepoint.
4. **egressIP not routable/assignable** to the gateway node — SNAT fails; the IP must belong to / be announceable by the node.
5. **Confusing it with NetworkPolicy** — egress gateway controls the EGRESS IP; NetworkPolicy controls whether the connection is allowed.

## Killer.sh Style Challenge

> An external database at \`203.0.113.5\` only accepts connections from IP \`192.0.2.10\`.
>
> 1. Enable the egress gateway in Cilium (with the prerequisites).
> 2. Mark a node as gateway with \`egress-node=true\`.
> 3. Create a CiliumEgressGatewayPolicy so the \`app=payments\` Pods in namespace \`production\` leave with \`egressIP: 192.0.2.10\` when accessing \`203.0.113.0/24\`.
> 4. Validate from the Pod that the externally seen source IP is \`192.0.2.10\`.
>
> Hint: \`curl ifconfig.me\` from inside the Pod and \`cilium-dbg bpf egress list\`.
`,

  quiz: [
    {
      question: 'Which problem does the Cilium Egress Gateway solve?',
      options: [
        'Ingress load balancing',
        'Giving a stable, predictable EGRESS IP to selected Pods, to integrate with external systems that allowlist by source IP',
        'Encrypting pod-to-pod traffic',
        'Replacing CoreDNS'
      ],
      correct: 1,
      explanation: 'Pod IPs are ephemeral; external systems (firewalls, SaaS, legacy databases) that filter by source IP do not work with that. The Egress Gateway routes the egress of selected Pods through a gateway node and SNATs to a fixed egressIP, which the external world can allowlist.',
      reference: 'Sections The problem and CiliumEgressGatewayPolicy.'
    },
    {
      question: 'What are the 3 essential ingredients of a CiliumEgressGatewayPolicy?',
      options: [
        'replicas, image and port',
        'podSelector (source), destinationCIDRs (destinations) and egressGateway nodeSelector+egressIP (where/which IP)',
        'host, path and tls',
        'minReplicas, maxReplicas and targetCPU'
      ],
      correct: 1,
      explanation: 'The policy defines: which Pods (selectors.podSelector), which external networks the rule applies to (destinationCIDRs), and which node to leave from with which SNAT IP (egressGateway.nodeSelector + egressIP). Only traffic from the selected Pods destined to the CIDRs is diverted.',
      reference: 'Section The 3 ingredients of the policy.'
    },
    {
      question: 'Which prerequisites does the Egress Gateway require in Cilium?',
      options: [
        'Only Hubble enabled',
        'kube-proxy replacement and BPF masquerade enabled',
        'IPsec enabled',
        'Gateway API installed'
      ],
      correct: 1,
      explanation: 'The Egress Gateway datapath depends on eBPF masquerading: kubeProxyReplacement=true and bpf.masquerade=true are required. Without these prerequisites, the CiliumEgressGatewayPolicy has no effect.',
      reference: 'Section Prerequisites.'
    },
    {
      question: 'Why is setting destinationCIDRs to 0.0.0.0/0 generally a bad idea?',
      options: [
        'Because Cilium rejects that value',
        'Because it diverts ALL cluster egress through the gateway node, creating a chokepoint and single point of failure',
        'Because it only works with IPv6',
        'Because it disables DNS'
      ],
      correct: 1,
      explanation: 'The egress gateway should only divert traffic that actually needs a stable IP (the CIDRs of the specific external systems). Using 0.0.0.0/0 sends all egress through a single node, concentrating bandwidth and creating an unnecessary single point of failure.',
      reference: 'Sections Common Mistakes (item 3) and When to use.'
    },
    {
      question: 'How do you validate that a selected Pod is leaving with the correct egressIP?',
      options: [
        'kubectl get pods -o wide',
        'From the Pod, hit a service that echoes the source IP (e.g. curl ifconfig.me) and confirm it returns the egressIP',
        'kubectl describe node',
        'Check the number of replicas'
      ],
      correct: 1,
      explanation: 'The practical validation is to have the selected Pod hit a service that returns the externally seen source IP (curl ifconfig.me / ifconfig.co). It should return the egressIP (e.g. 192.0.2.10), not the node IP. cilium-dbg bpf egress list shows the datapath mapping.',
      reference: 'Section Validating.'
    },
    {
      question: 'What happens to the diverted traffic if the only gateway node goes down?',
      options: [
        'Traffic automatically leaves via any node without SNAT',
        'Traffic to those destinations stops (timeouts) until failover; that is why HA/multiple gateways are recommended',
        'The Pods are restarted',
        'Cilium disables the policy by itself'
      ],
      correct: 1,
      explanation: 'The gateway node is a passthrough point. If it fails without HA, traffic from the Pods to the destinationCIDRs stops silently (just timeouts for that destination). That is why you use multiple eligible nodes and/or the egress gateway HA support of recent versions, plus monitoring the gateway health.',
      reference: 'Section High availability.'
    },
    {
      question: 'What is the difference between Egress Gateway and NetworkPolicy?',
      options: [
        'They are the same thing with different names',
        'Egress Gateway controls the EGRESS IP (SNAT) of traffic; NetworkPolicy controls WHETHER the connection is allowed',
        'NetworkPolicy does SNAT; Egress Gateway does allow/deny',
        'Egress Gateway only works for Ingress'
      ],
      correct: 1,
      explanation: 'They are complementary and distinct: NetworkPolicy decides whether a connection is allowed (allow/deny). The Egress Gateway does not decide permission — it changes the source IP (SNAT to a stable egressIP) of traffic leaving to the defined CIDRs. You can use both together.',
      reference: 'Sections When to use and Common Mistakes (item 5).'
    }
  ],

  flashcards: [
    {
      front: 'What is the Cilium Egress Gateway for?',
      back: 'Gives a **stable egress IP** (SNAT) to selected Pods, to integrate with external systems that **allowlist by source IP** (firewalls, SaaS, legacy databases).\n\nPod IPs are ephemeral; the egress gateway routes traffic through a gateway node that SNATs to a fixed, predictable `egressIP`.'
    },
    {
      front: 'CiliumEgressGatewayPolicy — the 3 key fields',
      back: '```yaml\nspec:\n  selectors:\n    - podSelector:        # 1. which Pods\n        matchLabels: {...}\n  destinationCIDRs:       # 2. to which destinations\n    - "203.0.113.0/24"\n  egressGateway:\n    nodeSelector: {...}    # 3. via which node\n    egressIP: "192.0.2.10" #    and which IP (SNAT)\n```\n\nOnly traffic from the selected Pods TO the CIDRs is diverted.'
    },
    {
      front: 'Egress Gateway prerequisites',
      back: 'Depends on the eBPF masquerading datapath:\n\n```bash\nhelm upgrade cilium cilium/cilium -n kube-system \\\n  --set egressGateway.enabled=true \\\n  --set kubeProxyReplacement=true \\\n  --set bpf.masquerade=true\n```\n\nWithout **kube-proxy replacement** + **bpf.masquerade**, the policy has no effect.'
    },
    {
      front: 'How to validate a Pod egressIP?',
      back: '```bash\n# From the selected Pod:\nkubectl exec -n production deploy/payments -- \\\n  curl -s https://ifconfig.me\n# Expected: 192.0.2.10 (egressIP), not the node IP\n\n# In the Cilium agent:\ncilium-dbg bpf egress list\n```'
    },
    {
      front: 'Egress Gateway vs NetworkPolicy',
      back: '**Egress Gateway** — changes the **egress IP** (SNAT to a stable egressIP) of traffic to certain CIDRs.\n\n**NetworkPolicy** — decides **whether** the connection is allowed (allow/deny).\n\nComplementary: one controls egress identity, the other controls permission. They can be used together.'
    },
    {
      front: 'Egress Gateway HA and pitfalls',
      back: '**HA**: the gateway node is a passthrough point; use multiple eligible nodes and/or the HA support of recent versions; monitor health (failure = silent timeouts).\n\n**Pitfalls**:\n- forgetting prerequisites (kube-proxy replacement/bpf.masquerade)\n- no node with the nodeSelector label\n- destinationCIDRs too broad (0.0.0.0/0 = chokepoint)\n- egressIP not assignable to the node'
    }
  ],

  lab: {
    scenario: 'Enable the egress gateway, mark a node as gateway and create a CiliumEgressGatewayPolicy so specific Pods leave with a fixed IP when accessing an external destination.',
    objective: 'Master the select Pods -> define destination -> SNAT to a stable egressIP flow, and how to validate the egress IP.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Enable the egress gateway and mark the node',
        instruction: 'Enable the egress gateway with the prerequisites and label a node as the egress gateway.',
        hints: ['kubeProxyReplacement + bpf.masquerade', 'kubectl label node ... egress-node=true'],
        solution: `\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system --reuse-values \\
  --set egressGateway.enabled=true \\
  --set kubeProxyReplacement=true \\
  --set bpf.masquerade=true

kubectl -n kube-system rollout restart ds/cilium
kubectl -n kube-system rollout status ds/cilium

# Choose and mark a node as gateway
GW=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
kubectl label node $GW egress-node=true --overwrite
\`\`\``,
        verify: `\`\`\`bash
kubectl get nodes -l egress-node=true
# Expected: 1 node marked

kubectl exec -n kube-system ds/cilium -- cilium status | grep -i 'kubeproxy\\|masquerad'
# Expected: KubeProxyReplacement True; Masquerading BPF
\`\`\``
      },
      {
        title: 'Create the CiliumEgressGatewayPolicy',
        instruction: 'Create the source app and a policy that makes its Pods leave via a fixed egressIP when accessing an external CIDR.',
        hints: ['podSelector + destinationCIDRs + egressIP', 'Set egressIP to a valid IP of the gateway node'],
        solution: `\`\`\`bash
kubectl create namespace production
kubectl -n production create deployment payments --image=curlimages/curl -- sleep 3600
kubectl -n production label deployment payments app=payments --overwrite

# Find a gateway node IP to use as egressIP
GW=$(kubectl get nodes -l egress-node=true -o jsonpath='{.items[0].metadata.name}')
EIP=$(kubectl get node $GW -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')

cat <<EOF | kubectl apply -f -
apiVersion: cilium.io/v2
kind: CiliumEgressGatewayPolicy
metadata:
  name: payments-egress
spec:
  selectors:
    - podSelector:
        matchLabels:
          app: payments
          io.kubernetes.pod.namespace: production
  destinationCIDRs:
    - "0.0.0.0/0"
  egressGateway:
    nodeSelector:
      matchLabels:
        egress-node: "true"
    egressIP: "$EIP"
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get ciliumegressgatewaypolicy payments-egress
# Expected: the policy listed

kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list
# Expected: entry mapping the payments Pods to the egressIP
\`\`\``
      },
      {
        title: 'Validate the egress IP',
        instruction: 'From the payments Pod, access a service that echoes the source IP and confirm it is the egressIP.',
        hints: ['curl ifconfig.me from inside the Pod', 'Compare with the gateway node IP'],
        solution: `\`\`\`bash
POD=$(kubectl -n production get pod -l app=payments -o jsonpath='{.items[0].metadata.name}')
kubectl -n production exec $POD -- curl -s https://ifconfig.me ; echo

# Compare with the expected egressIP (gateway node IP)
kubectl get nodes -l egress-node=true \\
  -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}'; echo
\`\`\``,
        verify: `\`\`\`bash
# The IP returned by curl should be the egressIP (gateway node IP),
# not the IP of the node where the Pod actually runs.

# Cleanup
kubectl delete ciliumegressgatewaypolicy payments-egress
kubectl delete namespace production
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Policy applied but the Pod still leaves with the node IP, not the egressIP',
      difficulty: 'medium',
      symptom: 'curl ifconfig.me from inside the selected Pod returns the IP of the node it runs on, not the egressIP configured in the CiliumEgressGatewayPolicy.',
      diagnosis: `\`\`\`bash
# 1. Are the prerequisites active?
kubectl exec -n kube-system ds/cilium -- cilium status | grep -i 'kubeproxy\\|masquerad'

# 2. Is there an eligible node for the nodeSelector?
kubectl get nodes -l egress-node=true

# 3. Does the Pod actually match the podSelector (labels + namespace)?
kubectl get pod <pod> -n production --show-labels

# 4. Is the hit destination within the destinationCIDRs?
kubectl get ciliumegressgatewaypolicy <name> -o jsonpath='{.spec.destinationCIDRs}'

# 5. Egress map in the datapath
kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list
\`\`\``,
      solution: `**Common causes:**

1. **Missing prerequisites** — without \`kubeProxyReplacement=true\` and \`bpf.masquerade=true\`, the diversion does not happen. Re-apply Helm with these flags and restart the DaemonSet.

2. **No node matches the nodeSelector** — the egressGateway.nodeSelector label does not match any node. Mark the node: \`kubectl label node <n> egress-node=true\`.

3. **podSelector does not match** — missing label or \`io.kubernetes.pod.namespace\`. Confirm the Pod labels and the namespace in the policy.

4. **Destination outside the destinationCIDRs** — you tested an IP not in the ranges; the rule only applies to the listed CIDRs.

\`\`\`bash
# After fixing, revalidate
kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list
kubectl -n production exec <pod> -- curl -s https://ifconfig.me
\`\`\`

**Prevention:** validate each of the 3 ingredients (source, destination, gateway) in isolation.`
    },
    {
      title: 'Traffic to the external destination stopped after the gateway node became unavailable',
      difficulty: 'hard',
      symptom: 'Everything worked, but after maintenance/failure of the node marked as gateway, the selected Pods started timing out only for the policy destinations. Other destinations remain normal.',
      diagnosis: `\`\`\`bash
# 1. Is the gateway node healthy?
kubectl get nodes -l egress-node=true
kubectl describe node <gw-node> | grep -A5 Conditions

# 2. Is there another eligible node to take over?
kubectl get nodes -l egress-node=true -o name | wc -l

# 3. Does the datapath still point to the dead gateway?
kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list
\`\`\``,
      solution: `**Cause:** the gateway node is the only egress point for the destinationCIDRs. Without HA, its failure interrupts the diverted traffic (only for those destinations), while the rest of the egress (which does not pass through the gateway) keeps working — which makes the diagnosis confusing.

**Fixes/strategies:**

1. **Multiple gateway nodes** — label more than one node with \`egress-node=true\` and use the **egress gateway HA** support of recent Cilium versions for automatic failover between eligible nodes.

2. **egressIP as a floating VIP** — instead of pinning the egressIP to a single node, use a virtual IP that can migrate between gateway nodes (managed by keepalived/cloud), to preserve the IP seen by the external firewall.

3. **Restore the node** — if it is the only gateway, recovering/recreating the node restores the path.

\`\`\`bash
# Add redundancy
kubectl label node <other-node> egress-node=true --overwrite
\`\`\`

**Prevention:** never run an egress gateway with a single node in production; monitor the gateway health and alert on timeouts to the destinationCIDRs.`
    }
  ]
};
