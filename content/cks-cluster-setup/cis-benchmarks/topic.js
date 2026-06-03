window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-cluster-setup/cis-benchmarks'] = {

  theory: `# CIS Benchmarks & kube-bench

## Relevancia no CKS
> O dominio "Cluster Setup" vale **10%** do CKS. CIS Benchmarks sao o padrao da industria para validar a seguranca de clusters Kubernetes. Voce deve saber executar kube-bench, interpretar resultados e remediar falhas.

---

## O que sao CIS Benchmarks?

O **Center for Internet Security (CIS)** publica benchmarks de seguranca para diversas tecnologias, incluindo Kubernetes. O CIS Kubernetes Benchmark define controles de seguranca organizados em secoes:

| Secao | Componente | Exemplos de Controles |
|-------|-----------|----------------------|
| 1 | Control Plane | API Server, Controller Manager, Scheduler, etcd |
| 2 | etcd | Configuracao segura do etcd |
| 3 | Control Plane Config | Authentication, Authorization |
| 4 | Worker Nodes | kubelet, kube-proxy |
| 5 | Policies | RBAC, Pod Security, Network Policies |

Cada controle e classificado como:
- **Scored**: verificavel automaticamente (PASS/FAIL)
- **Not Scored**: requer verificacao manual

---

## kube-bench

**kube-bench** (Aqua Security) e a ferramenta padrao para verificar conformidade com CIS Benchmarks.

### Instalacao e Execucao

\`\`\`bash
# Executar como container no node
docker run --pid=host --network=host --userns=host \\
  -v /etc:/etc:ro -v /var:/var:ro \\
  -v /usr/bin/containerd:/usr/bin/containerd:ro \\
  -t aquasec/kube-bench:latest run

# Executar como Job no cluster
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml

# Verificar resultados do Job
kubectl logs job/kube-bench
\`\`\`

### Executar Secoes Especificas

\`\`\`bash
# Apenas master node checks
kube-bench run --targets=master

# Apenas worker node checks
kube-bench run --targets=node

# Apenas policies
kube-bench run --targets=policies

# Secao especifica (ex: API Server)
kube-bench run --targets=master --check=1.2
\`\`\`

### Formato de Saida

\`\`\`bash
# Saida JSON para automacao
kube-bench run --json

# Saida JUnit para CI/CD
kube-bench run --junit
\`\`\`

---

## Interpretando Resultados

\`\`\`text
[PASS] 1.2.1 Ensure that the --anonymous-auth argument is set to false
[FAIL] 1.2.2 Ensure that the --token-auth-file parameter is not set
[WARN] 1.2.3 Ensure that the --DenyServiceExternalIPs is not set
[INFO] 1.2.4 Ensure that the --kubelet-https argument is set to true

== Summary ==
45 checks PASS
10 checks FAIL
8 checks WARN
3 checks INFO
\`\`\`

| Status | Significado | Acao |
|--------|------------|------|
| **PASS** | Controle atendido | Nenhuma acao necessaria |
| **FAIL** | Controle nao atendido | Remediar imediatamente |
| **WARN** | Requer verificacao manual | Investigar |
| **INFO** | Informativo | Considerar |

---

## Remediando Falhas Comuns

### 1. API Server: Anonymous Auth

\`\`\`bash
# FAIL: anonymous-auth habilitado
# Remediar: editar /etc/kubernetes/manifests/kube-apiserver.yaml
# Adicionar flag:
#   --anonymous-auth=false
\`\`\`

### 2. API Server: Token Auth File

\`\`\`bash
# FAIL: --token-auth-file esta definido
# Remediar: remover a flag --token-auth-file do manifest
# Usar certificados ou OIDC ao inves de static tokens
\`\`\`

### 3. kubelet: Anonymous Auth

\`\`\`yaml
# /var/lib/kubelet/config.yaml
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
authorization:
  mode: Webhook
\`\`\`

### 4. etcd: Peer TLS

\`\`\`bash
# Garantir que etcd usa TLS para comunicacao entre peers
# Flags necessarias no etcd:
#   --peer-cert-file
#   --peer-key-file
#   --peer-client-cert-auth=true
#   --peer-trusted-ca-file
\`\`\`

---

## kube-bench como Job no Cluster

\`\`\`yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: kube-bench
spec:
  template:
    metadata:
      labels:
        app: kube-bench
    spec:
      hostPID: true
      containers:
      - name: kube-bench
        image: aquasec/kube-bench:latest
        command: ["kube-bench", "run", "--targets", "node"]
        volumeMounts:
        - name: var-lib-kubelet
          mountPath: /var/lib/kubelet
          readOnly: true
        - name: etc-systemd
          mountPath: /etc/systemd
          readOnly: true
        - name: etc-kubernetes
          mountPath: /etc/kubernetes
          readOnly: true
      restartPolicy: Never
      volumes:
      - name: var-lib-kubelet
        hostPath:
          path: /var/lib/kubelet
      - name: etc-systemd
        hostPath:
          path: /etc/systemd
      - name: etc-kubernetes
        hostPath:
          path: /etc/kubernetes
\`\`\`

---

## kube-bench vs kube-hunter

| Ferramenta | Tipo | Foco | Abordagem |
|-----------|------|------|-----------|
| **kube-bench** | Compliance | Configuracao do cluster | Verifica flags e configs locais |
| **kube-hunter** | Pentest | Vulnerabilidades de rede | Scan remoto, ataque simulado |

---

## Erros Comuns

1. **Executar kube-bench sem acesso aos arquivos de config** — precisa montar /etc e /var
2. **Ignorar WARN** — muitos WARN sao tao criticos quanto FAIL
3. **Nao re-executar apos remediacoes** — sempre validar que o fix funcionou
4. **Aplicar fixes sem entender o impacto** — algumas flags podem quebrar o cluster

---

## Killer.sh Style Challenge

> Voce recebeu um relatorio do kube-bench mostrando que o API Server tem \`--anonymous-auth=true\` e o kubelet aceita conexoes anonimas. Remedie ambos os problemas e valide com kube-bench.
`,

  quiz: [
    {
      question: 'Qual ferramenta e usada para verificar conformidade com CIS Kubernetes Benchmarks?',
      options: ['kube-hunter', 'kube-bench', 'trivy', 'falco'],
      correct: 1,
      explanation: 'kube-bench (Aqua Security) e a ferramenta padrao para verificar conformidade com CIS Kubernetes Benchmarks. Ela analisa configuracoes do cluster contra os controles do CIS.',
      reference: 'Conceito relacionado: CIS Benchmarks — secao de ferramentas de compliance.'
    },
    {
      question: 'O que significa o status FAIL no resultado do kube-bench?',
      options: ['O controle e informativo', 'O controle nao foi atendido e precisa remediacao', 'O controle precisa verificacao manual', 'O controle nao se aplica ao ambiente'],
      correct: 1,
      explanation: 'FAIL indica que o controle de seguranca nao foi atendido e deve ser remediado. PASS indica conformidade, WARN requer verificacao manual e INFO e informativo.',
      reference: 'Conceito relacionado: Interpretacao de resultados kube-bench.'
    },
    {
      question: 'Qual flag do kube-bench executa apenas verificacoes nos worker nodes?',
      options: ['--targets=master', '--targets=node', '--targets=worker', '--targets=policies'],
      correct: 1,
      explanation: 'A flag --targets=node executa apenas as verificacoes relacionadas aos worker nodes (secao 4 do CIS Benchmark).',
      reference: 'Conceito relacionado: Execucao seletiva do kube-bench.'
    },
    {
      question: 'Qual secao do CIS Benchmark cobre o API Server?',
      options: ['Secao 2 (etcd)', 'Secao 1 (Control Plane)', 'Secao 4 (Worker Nodes)', 'Secao 5 (Policies)'],
      correct: 1,
      explanation: 'A Secao 1 (Control Plane Components) cobre API Server, Controller Manager e Scheduler. etcd e Secao 2, Workers sao Secao 4.',
      reference: 'Conceito relacionado: Estrutura do CIS Kubernetes Benchmark.'
    },
    {
      question: 'Qual a diferenca principal entre kube-bench e kube-hunter?',
      options: [
        'kube-bench faz pentest e kube-hunter faz compliance',
        'kube-bench verifica configuracoes locais e kube-hunter faz scan de rede',
        'kube-bench e para workers e kube-hunter para masters',
        'Nao ha diferenca, sao aliases do mesmo projeto'
      ],
      correct: 1,
      explanation: 'kube-bench verifica configuracoes locais contra CIS Benchmarks (compliance). kube-hunter faz scan de rede simulando ataques (pentest).',
      reference: 'Conceito relacionado: kube-bench vs kube-hunter.'
    },
    {
      question: 'Para executar kube-bench como container, quais volumes sao necessarios?',
      options: [
        'Apenas /etc/kubernetes',
        '/etc e /var (read-only) alem de hostPID',
        'Apenas /var/lib/kubelet',
        'Nenhum volume, funciona isolado'
      ],
      correct: 1,
      explanation: 'kube-bench precisa acesso aos arquivos de configuracao em /etc (kubernetes, systemd) e /var (kubelet), montados como read-only. hostPID tambem e necessario para verificar processos.',
      reference: 'Conceito relacionado: Execucao do kube-bench como container.'
    },
    {
      question: 'Qual remediacacao correta para desabilitar autenticacao anonima no kubelet?',
      options: [
        'Adicionar --anonymous-auth=false no kube-apiserver',
        'Setar authentication.anonymous.enabled: false no config.yaml do kubelet',
        'Remover o kubelet do node',
        'Configurar --disable-anonymous no kube-proxy'
      ],
      correct: 1,
      explanation: 'A configuracao do kubelet fica em /var/lib/kubelet/config.yaml. Setar authentication.anonymous.enabled: false desabilita acesso anonimo ao kubelet API.',
      reference: 'Conceito relacionado: Hardening do kubelet — autenticacao.'
    }
  ],

  flashcards: [
    { front: 'O que sao CIS Benchmarks?', back: 'Benchmarks de seguranca publicados pelo Center for Internet Security que definem controles para validar a configuracao segura de sistemas, incluindo Kubernetes. Organizados em secoes (Control Plane, etcd, Worker Nodes, Policies).' },
    { front: 'O que e kube-bench?', back: 'Ferramenta open-source da Aqua Security que verifica se um cluster Kubernetes esta configurado de acordo com os CIS Kubernetes Benchmarks. Analisa configuracoes locais e reporta PASS/FAIL/WARN/INFO.' },
    { front: 'Quais sao os status possiveis no kube-bench?', back: 'PASS (controle atendido), FAIL (nao atendido, remediar), WARN (requer verificacao manual), INFO (informativo).' },
    { front: 'Como executar kube-bench apenas nos worker nodes?', back: 'kube-bench run --targets=node. Isso executa apenas os controles da Secao 4 (Worker Nodes) do CIS Benchmark.' },
    { front: 'Qual a diferenca entre kube-bench e kube-hunter?', back: 'kube-bench faz verificacao de compliance (configuracoes locais vs CIS). kube-hunter faz pentest de rede (scan remoto, simulando ataques de fora do cluster).' },
    { front: 'O que e um controle Scored vs Not Scored?', back: 'Scored: pode ser verificado automaticamente (resulta em PASS ou FAIL). Not Scored: requer verificacao manual (resulta em WARN ou INFO).' },
    { front: 'Quais volumes o kube-bench precisa quando roda como container?', back: '/etc (kubernetes configs, systemd), /var (kubelet), montados como read-only. Tambem precisa de hostPID: true para verificar processos em execucao.' },
    { front: 'Como gerar saida JSON do kube-bench?', back: 'kube-bench run --json. Util para automacao e integracao com CI/CD. Tambem suporta --junit para formato JUnit.' }
  ],

  lab: {
    scenario: 'Voce precisa auditar a seguranca de um cluster Kubernetes usando kube-bench e remediar as falhas encontradas.',
    objective: 'Executar kube-bench, interpretar os resultados e remediar falhas de seguranca comuns.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Executar kube-bench como Job',
        instruction: 'Crie um Job para executar kube-bench nos worker nodes do cluster e analise os resultados.',
        hints: [
          'Use a imagem aquasec/kube-bench:latest',
          'O Job precisa hostPID: true e volumes montando /var/lib/kubelet e /etc/kubernetes',
          'Use kubectl logs para ver os resultados'
        ],
        solution: '```bash\n# Criar o Job\nkubectl apply -f - <<EOF\napiVersion: batch/v1\nkind: Job\nmetadata:\n  name: kube-bench-node\nspec:\n  template:\n    spec:\n      hostPID: true\n      containers:\n      - name: kube-bench\n        image: aquasec/kube-bench:latest\n        command: ["kube-bench", "run", "--targets", "node"]\n        volumeMounts:\n        - name: var-lib-kubelet\n          mountPath: /var/lib/kubelet\n          readOnly: true\n        - name: etc-kubernetes\n          mountPath: /etc/kubernetes\n          readOnly: true\n      restartPolicy: Never\n      volumes:\n      - name: var-lib-kubelet\n        hostPath:\n          path: /var/lib/kubelet\n      - name: etc-kubernetes\n        hostPath:\n          path: /etc/kubernetes\nEOF\n\n# Ver resultados\nkubectl wait --for=condition=complete job/kube-bench-node --timeout=60s\nkubectl logs job/kube-bench-node\n```',
        verify: '```bash\n# Verificar que o Job completou\nkubectl get job kube-bench-node\n# Saida esperada: COMPLETIONS 1/1\n\n# Verificar que ha output\nkubectl logs job/kube-bench-node | grep -c "\\[PASS\\]\\|\\[FAIL\\]\\|\\[WARN\\]\"\n# Saida esperada: numero > 0\n```'
      },
      {
        title: 'Identificar e Analisar Falhas',
        instruction: 'Filtre os resultados para mostrar apenas as falhas (FAIL) e identifique os controles que precisam remediacao.',
        hints: [
          'Use grep para filtrar linhas com FAIL',
          'Preste atencao nos numeros dos controles para saber o que remediar',
          'Verifique o summary no final do output'
        ],
        solution: '```bash\n# Filtrar apenas FAILs\nkubectl logs job/kube-bench-node | grep \"\\[FAIL\\]\"\n\n# Ver o summary\nkubectl logs job/kube-bench-node | tail -10\n\n# Ver remediacao sugerida para um controle especifico\nkubectl logs job/kube-bench-node | grep -A 5 \"4.2.1\"\n```',
        verify: '```bash\n# Verificar que consegue filtrar FAILs\nkubectl logs job/kube-bench-node | grep -c \"\\[FAIL\\]\"\n# Saida esperada: numero de falhas encontradas\n```'
      },
      {
        title: 'Remediar Configuracao do kubelet',
        instruction: 'Corrija a configuracao do kubelet para desabilitar autenticacao anonima e habilitar autorizacao via Webhook.',
        hints: [
          'O config do kubelet fica em /var/lib/kubelet/config.yaml',
          'Setar authentication.anonymous.enabled: false',
          'Setar authorization.mode: Webhook',
          'Reiniciar o kubelet apos a mudanca'
        ],
        solution: '```bash\n# Editar config do kubelet\nsudo vi /var/lib/kubelet/config.yaml\n\n# Garantir estas configuracoes:\n# authentication:\n#   anonymous:\n#     enabled: false\n#   webhook:\n#     enabled: true\n# authorization:\n#   mode: Webhook\n\n# Reiniciar kubelet\nsudo systemctl restart kubelet\n\n# Re-executar kube-bench para validar\nkubectl delete job kube-bench-node\n# (re-criar o Job)\n```',
        verify: '```bash\n# Verificar que kubelet esta rodando\nsudo systemctl status kubelet\n# Saida esperada: active (running)\n\n# Verificar config\nsudo cat /var/lib/kubelet/config.yaml | grep -A 2 anonymous\n# Saida esperada: enabled: false\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'kube-bench Reporta Muitos FAILs Apos Instalacao',
      difficulty: 'easy',
      symptom: 'Cluster recem-instalado com kubeadm mostra diversos FAILs no kube-bench, especialmente relacionados a autenticacao e TLS.',
      diagnosis: '```bash\n# Ver todos os FAILs\nkube-bench run --targets=master | grep "\\[FAIL\\]"\n\n# Verificar flags do API Server\ncat /etc/kubernetes/manifests/kube-apiserver.yaml | grep -E "anonymous-auth|insecure|profiling"\n\n# Verificar config do kubelet\ncat /var/lib/kubelet/config.yaml | grep -A 3 "authentication"\n```',
      solution: 'Instalacoes padrao do kubeadm nao atendem todos os controles CIS por padrao. Remedie os FAILs um por um: desabilite anonymous-auth, habilite audit logging, configure kubelet authentication webhook, desabilite profiling no API Server. Sempre re-execute kube-bench apos cada remediacao para confirmar.'
    },
    {
      title: 'kube-bench Job Falha com Permission Denied',
      difficulty: 'medium',
      symptom: 'O Job do kube-bench falha com erros de permissao ao tentar ler arquivos de configuracao do node.',
      diagnosis: '```bash\n# Verificar logs do pod\nkubectl logs job/kube-bench\n\n# Verificar se volumes estao montados\nkubectl describe pod -l job-name=kube-bench\n\n# Verificar se hostPID esta configurado\nkubectl get job kube-bench -o yaml | grep hostPID\n```',
      solution: 'O Job do kube-bench precisa de: 1) hostPID: true para inspecionar processos, 2) volumes montando /etc/kubernetes, /var/lib/kubelet e /etc/systemd como readOnly, 3) o container pode precisar rodar como root (securityContext.runAsUser: 0) dependendo das permissoes dos arquivos no node.'
    }
  ]
};
