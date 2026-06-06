window.K8S_REGISTRY = {
  certifications: [
    { id: 'cka',  label: 'CKA',  fullName: 'Certified Kubernetes Administrator', passScore: 66, group: 'kubernetes' },
    { id: 'ckad', label: 'CKAD', fullName: 'Certified Kubernetes Application Developer', passScore: 66, group: 'kubernetes' },
    { id: 'cks',  label: 'CKS',  fullName: 'Certified Kubernetes Security Specialist', passScore: 67, group: 'kubernetes' },
    { id: 'kcna', label: 'KCNA', fullName: 'Kubernetes and Cloud Native Associate', passScore: 75, group: 'kubernetes' },
    { id: 'kcsa', label: 'KCSA', fullName: 'Kubernetes and Cloud Native Security Associate', passScore: 75, group: 'kubernetes' },
    { id: 'aws-clf', label: 'CLF', fullName: 'AWS Cloud Practitioner (CLF-C02)', passScore: 70, group: 'aws' },
    { id: 'aws-saa', label: 'SAA', fullName: 'AWS Solutions Architect Associate (SAA-C03)', passScore: 72, group: 'aws' },
    { id: 'aws-sap', label: 'SAP', fullName: 'AWS Solutions Architect Professional (SAP-C02)', passScore: 75, group: 'aws' },
    { id: 'az-104', label: 'AZ-104', fullName: 'Microsoft Azure Administrator', passScore: 70, group: 'azure' },
    { id: 'az-305', label: 'AZ-305', fullName: 'Microsoft Azure Solutions Architect Expert', passScore: 70, group: 'azure' }
  ],

  // ═══════════════════════════════════════════════════════════════════════
  //   Skill Tracks — lateral skills beyond K8s certifications
  // ═══════════════════════════════════════════════════════════════════════
  skillTracks: [
    { id: 'prometheus',       label: 'PROM',    fullName: 'Prometheus & Monitoring Stack',           icon: '🔥' },
    { id: 'argocd',           label: 'ARGO',    fullName: 'ArgoCD & GitOps',                         icon: '🐙' },
    { id: 'sre-practices',    label: 'SRE',     fullName: 'SRE Practices & Reliability',             icon: '📈' },
    { id: 'cilium',           label: 'CILIUM',  fullName: 'Cilium & eBPF Networking',                icon: '🐝' },
    { id: 'istio',            label: 'ISTIO',   fullName: 'Istio Service Mesh',                      icon: '🕸️' },
    { id: 'security-tooling', label: 'SECTOOL', fullName: 'Security Tooling (Vault, cert-manager)',  icon: '🔐' },
    { id: 'platform-eng',     label: 'PLAT',    fullName: 'Platform Engineering & IDPs',             icon: '🏗️' },
    { id: 'iac',              label: 'IAC',     fullName: 'Infrastructure as Code (Terraform)',       icon: '⚙️' },
    { id: 'helm-advanced',    label: 'HELM',    fullName: 'Helm Chart Development & Advanced',        icon: '⛵' },
    { id: 'otel',             label: 'OTEL',    fullName: 'OpenTelemetry & Distributed Tracing',     icon: '🔭' },
    { id: 'chaos-eng',        label: 'CHAOS',   fullName: 'Chaos Engineering',                       icon: '🌀' },
    { id: 'crossplane',       label: 'XPLANE',  fullName: 'Crossplane & Platform APIs',              icon: '⚓' },
    { id: 'kyverno',          label: 'KYVRNO',  fullName: 'Kyverno Policy Engine',                   icon: '📜' },
    { id: 'fluxcd',           label: 'FLUX',    fullName: 'FluxCD & GitOps',                         icon: '🌊' },
    { id: 'kong',             label: 'KONG',    fullName: 'Kong API Gateway',                        icon: '🦍' },
    { id: 'ai-engineering',   label: 'AI',      fullName: 'AI Engineering para DevOps/SRE',          icon: '🤖' },
    { id: 'docker',           label: 'DOCKER',  fullName: 'Docker & Containers',                     icon: '🐳' },
    { id: 'cicd',             label: 'CICD',    fullName: 'CI/CD Pipelines',                         icon: '🚀' },
    { id: 'loki',             label: 'LOKI',    fullName: 'Loki & Logging Stack',                    icon: '📋' },
    { id: 'keda',             label: 'KEDA',    fullName: 'KEDA & Event-Driven Autoscaling',         icon: '⚡' },
    { id: 'finops',           label: 'FINOPS',  fullName: 'FinOps & Kubernetes Cost Management',     icon: '💰' },
    { id: 'databases-k8s',   label: 'DBK8S',   fullName: 'Databases on Kubernetes',                 icon: '🗄️' },
    { id: 'opa',              label: 'OPA',     fullName: 'OPA & Gatekeeper',                        icon: '🛡️' }
  ],

  domains: [
    // ═══════════════════════════════════════════════════════════════════════
    // CKA: Cluster Architecture, Installation & Configuration (25%)
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'cluster-architecture',
      name: 'Cluster Architecture, Installation & Configuration',
      weight: 25, icon: '\u{1F3D7}', cert: ['cka'], type: 'cert',
      topics: [
        { id: 'pods', name: 'Understanding Pods', difficulty: 'easy', path: 'cluster-architecture/pods', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['pod','container','basic'] },
        { id: 'rbac', name: 'RBAC', difficulty: 'medium', path: 'cluster-architecture/rbac', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['rbac','role','clusterrole','rolebinding','security'], related: ['cks-cluster-hardening/rbac-advanced', 'kcsa-k8s-security/rbac-overview', 'app-environment/security'] },
        { id: 'kubeadm', name: 'Kubeadm & Cluster Lifecycle', difficulty: 'hard', path: 'cluster-architecture/kubeadm', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kubeadm','install','upgrade','cluster'] },
        { id: 'etcd', name: 'ETCD Backup & Restore', difficulty: 'hard', path: 'cluster-architecture/etcd', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['etcd','backup','restore','snapshot'] },
        { id: 'helm-kustomize', name: 'Helm & Kustomize', difficulty: 'medium', path: 'cluster-architecture/helm-kustomize', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['helm','kustomize','package','template'], related: ['app-deployment/helm', 'app-deployment/kustomize', 'fluxcd/fluxcd-sources'] },
        { id: 'crds-operators', name: 'CRDs, Operators & Extensions', difficulty: 'hard', path: 'cluster-architecture/crds-operators', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['crd','operator','cni','csi','cri'], related: ['kyverno/kyverno-fundamentals'] },
        { id: 'kubectl-productivity', name: 'kubectl: Speed, JSONPath & Output', difficulty: 'medium', path: 'cluster-architecture/kubectl-productivity', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kubectl','jsonpath','dry-run','custom-columns','imperative','exam-speed'], related: ['cluster-architecture/pods', 'workloads/deployments', 'troubleshooting/monitoring'] }
      ]
    },
    // ═══════════════════════════════════════════════════════════════════════
    // CKA+CKAD: Workloads & Scheduling (CKA 15%)
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'workloads',
      name: 'Workloads & Scheduling',
      weight: 15, icon: '\u{2699}', cert: ['cka', 'ckad'], type: 'cert',
      topics: [
        { id: 'deployments', name: 'Deployments & Rolling Updates', difficulty: 'medium', path: 'workloads/deployments', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['deployment','replicaset','rollout','scaling'] },
        { id: 'configmaps-secrets', name: 'ConfigMaps & Secrets', difficulty: 'medium', path: 'workloads/configmaps-secrets', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['configmap','secret','env','volume','config'], related: ['cks-microservice-vuln/secrets-management', 'security-tooling/vault-k8s', 'security-tooling/external-secrets', 'kcsa-k8s-security/secrets-overview'] },
        { id: 'scheduling', name: 'Pod Scheduling', difficulty: 'hard', path: 'workloads/scheduling', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['taint','toleration','affinity','nodeselector','scheduler'] },
        { id: 'autoscaling', name: 'Autoscaling & Self-Healing', difficulty: 'medium', path: 'workloads/autoscaling', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['hpa','replicaset','liveness','readiness','self-healing'], related: ['keda/keda-fundamentals', 'finops/k8s-cost-management'] }
      ]
    },
    // ═══════════════════════════════════════════════════════════════════════
    // CKA+CKAD: Services & Networking (CKA 20%)
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'services-networking',
      name: 'Services & Networking',
      weight: 20, icon: '\u{1F310}', cert: ['cka', 'ckad'], type: 'cert',
      topics: [
        { id: 'services', name: 'Service Types & Endpoints', difficulty: 'medium', path: 'services-networking/services', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['service','clusterip','nodeport','loadbalancer','endpoint'], related: ['cilium-advanced/cilium-service-mesh', 'istio-fundamentals/istio-traffic-mgmt'] },
        { id: 'network-policies', name: 'Network Policies', difficulty: 'hard', path: 'services-networking/network-policies', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['networkpolicy','ingress','egress','isolation'], related: ['cilium-fundamentals/cilium-network-policies', 'kcsa-cluster-security/k8s-networking-security'] },
        { id: 'ingress', name: 'Ingress & Gateway API', difficulty: 'medium', path: 'services-networking/ingress', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['ingress','ingresscontroller','gateway','routing'], related: ['services-networking/gateway-api', 'kong/kong-fundamentals', 'security-tooling/cert-manager', 'istio-fundamentals/istio-gateway'] },
        { id: 'gateway-api', name: 'Gateway API', difficulty: 'medium', path: 'services-networking/gateway-api', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['gateway-api','gatewayclass','httproute','referencegrant','routing','traffic-splitting'], related: ['services-networking/ingress', 'services-networking/services', 'istio-fundamentals/istio-gateway', 'cilium-advanced/cilium-service-mesh'] },
        { id: 'coredns', name: 'CoreDNS', difficulty: 'medium', path: 'services-networking/coredns', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['dns','coredns','service-discovery','resolution'] }
      ]
    },
    // ── CKA: Storage (10%) ──────────────────────────────────────────────
    {
      id: 'storage',
      name: 'Storage',
      weight: 10, icon: '\u{1F4BE}', cert: ['cka'], type: 'cert',
      topics: [
        { id: 'pv-pvc', name: 'Persistent Volumes & Claims', difficulty: 'medium', path: 'storage/pv-pvc', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['pv','pvc','persistent','claim','binding'] },
        { id: 'volumes', name: 'Volume Types & Storage Classes', difficulty: 'medium', path: 'storage/volumes', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['volume','storageclass','emptydir','hostpath','dynamic'] }
      ]
    },
    // ── CKA: Troubleshooting (30%) ──────────────────────────────────────
    {
      id: 'troubleshooting',
      name: 'Troubleshooting',
      weight: 30, icon: '\u{1F527}', cert: ['cka'], type: 'cert',
      topics: [
        { id: 'app-failure', name: 'Application Failure', difficulty: 'hard', path: 'troubleshooting/app-failure', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['debug','crashloopbackoff','logs','events'] },
        { id: 'cluster-troubleshooting', name: 'Cluster & Node Troubleshooting', difficulty: 'hard', path: 'troubleshooting/cluster-troubleshooting', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kubelet','node','notready','component'], related: ['troubleshooting/crictl-runtime'] },
        { id: 'crictl-runtime', name: 'crictl & Container Runtime Debugging', difficulty: 'hard', path: 'troubleshooting/crictl-runtime', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['crictl','containerd','cri','static-pod','runtime','kubelet'], related: ['troubleshooting/cluster-troubleshooting', 'cluster-architecture/kubeadm', 'cluster-architecture/etcd'] },
        { id: 'network-troubleshooting', name: 'Service & Network Troubleshooting', difficulty: 'hard', path: 'troubleshooting/network-troubleshooting', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['service','dns','connectivity','endpoint'] },
        { id: 'monitoring', name: 'Monitoring & Logging', difficulty: 'medium', path: 'troubleshooting/monitoring', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['metrics','top','logs','events','monitoring'], related: ['prom-fundamentals/prom-architecture', 'kcna-observability/observability-fundamentals', 'opentelemetry/otel-fundamentals', 'sre-fundamentals/sre-observability'] }
      ]
    },
    // ── CKAD: Application Design and Build (20%) ────────────────────────
    {
      id: 'app-design-build',
      name: 'Application Design and Build',
      weight: 20, icon: '\u{1F4E6}', cert: ['ckad'], type: 'cert',
      topics: [
        { id: 'container-images', name: 'Container Images & Dockerfile', difficulty: 'easy', path: 'app-design-build/container-images', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['container','image','dockerfile','build','registry'] },
        { id: 'workload-resources', name: 'Jobs, CronJobs & DaemonSets', difficulty: 'medium', path: 'app-design-build/workload-resources', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['job','cronjob','daemonset','statefulset'] },
        { id: 'multi-container', name: 'Multi-Container Patterns', difficulty: 'medium', path: 'app-design-build/multi-container', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['sidecar','init','ambassador','adapter'] }
      ]
    },
    // ── CKAD: Application Deployment (20%) ──────────────────────────────
    {
      id: 'app-deployment',
      name: 'Application Deployment',
      weight: 20, icon: '\u{1F680}', cert: ['ckad'], type: 'cert',
      topics: [
        { id: 'deployment-strategies', name: 'Deployment Strategies', difficulty: 'medium', path: 'app-deployment/deployment-strategies', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['bluegreen','canary','rolling','recreate'] },
        { id: 'helm', name: 'Helm Package Manager', difficulty: 'medium', path: 'app-deployment/helm', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['helm','chart','release','values','template'] },
        { id: 'kustomize', name: 'Kustomize', difficulty: 'medium', path: 'app-deployment/kustomize', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kustomize','overlay','base','patch','kustomization'] }
      ]
    },
    // ── CKAD: Application Observability and Maintenance (15%) ───────────
    {
      id: 'observability',
      name: 'Application Observability and Maintenance',
      weight: 15, icon: '\u{1F4CA}', cert: ['ckad'], type: 'cert',
      topics: [
        { id: 'probes', name: 'Probes & Health Checks', difficulty: 'medium', path: 'observability/probes', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['liveness','readiness','startup','probe','healthcheck'], related: ['troubleshooting/app-failure'] },
        { id: 'debugging', name: 'Debugging & API Deprecations', difficulty: 'hard', path: 'observability/debugging', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['debug','logs','events','deprecation','api'] }
      ]
    },
    // ── CKAD: App Environment, Config and Security (25%) ────────────────
    {
      id: 'app-environment',
      name: 'Application Environment, Configuration and Security',
      weight: 25, icon: '\u{1F512}', cert: ['ckad'], type: 'cert',
      topics: [
        { id: 'requests-limits', name: 'Requests, Limits & Quotas', difficulty: 'medium', path: 'app-environment/requests-limits', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['requests','limits','quota','limitrange','resources'] },
        { id: 'security', name: 'Security Contexts & ServiceAccounts', difficulty: 'hard', path: 'app-environment/security', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['securitycontext','serviceaccount','capabilities','runasuser','rbac'], related: ['cks-system-hardening/seccomp', 'cks-system-hardening/apparmor', 'cks-microservice-vuln/pod-security-standards'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   CKS — Certified Kubernetes Security Specialist
    // ═══════════════════════════════════════════════════════════════════════

    // ── CKS: Cluster Setup (10%) ────────────────────────────────────────
    {
      id: 'cks-cluster-setup',
      name: 'Cluster Setup',
      weight: 10, icon: '\u{1F6E1}', cert: ['cks'], type: 'cert',
      topics: [
        { id: 'cis-benchmarks', name: 'CIS Benchmarks & kube-bench', difficulty: 'medium', path: 'cks-cluster-setup/cis-benchmarks', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['cis','kube-bench','compliance','audit'] },
        { id: 'ingress-tls', name: 'Ingress Security & TLS', difficulty: 'medium', path: 'cks-cluster-setup/ingress-tls', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['ingress','tls','certificate','https'] },
        { id: 'node-metadata', name: 'Node Metadata Protection', difficulty: 'hard', path: 'cks-cluster-setup/node-metadata', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['metadata','cloud','imds','firewall'] }
      ]
    },
    // ── CKS: Cluster Hardening (15%) ────────────────────────────────────
    {
      id: 'cks-cluster-hardening',
      name: 'Cluster Hardening',
      weight: 15, icon: '\u{1F510}', cert: ['cks'], type: 'cert',
      topics: [
        { id: 'rbac-advanced', name: 'RBAC Hardening', difficulty: 'hard', path: 'cks-cluster-hardening/rbac-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['rbac','least-privilege','serviceaccount','audit'], related: ['kcsa-k8s-security/rbac-overview', 'cks-cluster-hardening/serviceaccount-hardening'] },
        { id: 'api-server-security', name: 'API Server Security', difficulty: 'hard', path: 'cks-cluster-hardening/api-server-security', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['apiserver','anonymous-auth','admission-controller','encryption'] },
        { id: 'serviceaccount-hardening', name: 'ServiceAccount Hardening', difficulty: 'medium', path: 'cks-cluster-hardening/serviceaccount-hardening', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['serviceaccount','automount','token','least-privilege'] }
      ]
    },
    // ── CKS: System Hardening (15%) ─────────────────────────────────────
    {
      id: 'cks-system-hardening',
      name: 'System Hardening',
      weight: 15, icon: '\u{1F9F1}', cert: ['cks'], type: 'cert',
      topics: [
        { id: 'apparmor', name: 'AppArmor Profiles', difficulty: 'hard', path: 'cks-system-hardening/apparmor', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['apparmor','profile','kernel','security'] },
        { id: 'seccomp', name: 'Seccomp Profiles', difficulty: 'hard', path: 'cks-system-hardening/seccomp', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['seccomp','syscall','filter','security'] },
        { id: 'os-hardening', name: 'OS Level Security', difficulty: 'medium', path: 'cks-system-hardening/os-hardening', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['os','footprint','packages','iam'] }
      ]
    },
    // ── CKS: Minimize Microservice Vulnerabilities (20%) ────────────────
    {
      id: 'cks-microservice-vuln',
      name: 'Minimize Microservice Vulnerabilities',
      weight: 20, icon: '\u{1F41E}', cert: ['cks'], type: 'cert',
      topics: [
        { id: 'pod-security-standards', name: 'Pod Security Standards & Admission', difficulty: 'hard', path: 'cks-microservice-vuln/pod-security-standards', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['pss','psa','privileged','baseline','restricted'], related: ['kcsa-k8s-security/pod-security-overview'] },
        { id: 'opa-gatekeeper', name: 'OPA & Gatekeeper', difficulty: 'hard', path: 'cks-microservice-vuln/opa-gatekeeper', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['opa','gatekeeper','rego','policy','admission'], related: ['opa/opa-gatekeeper', 'kyverno/kyverno-fundamentals', 'kcsa-platform-security/admission-controllers-overview'] },
        { id: 'secrets-management', name: 'Secrets Management & Encryption', difficulty: 'hard', path: 'cks-microservice-vuln/secrets-management', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['secrets','encryption','etcd','kms','encryptionconfiguration'] },
        { id: 'runtime-sandboxing', name: 'Container Runtime Sandboxing', difficulty: 'hard', path: 'cks-microservice-vuln/runtime-sandboxing', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['gvisor','kata','runtimeclass','sandbox','isolation'] }
      ]
    },
    // ── CKS: Supply Chain Security (20%) ────────────────────────────────
    {
      id: 'cks-supply-chain',
      name: 'Supply Chain Security',
      weight: 20, icon: '\u{1F517}', cert: ['cks'], type: 'cert',
      topics: [
        { id: 'image-scanning', name: 'Image Scanning & Vulnerability Analysis', difficulty: 'medium', path: 'cks-supply-chain/image-scanning', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['trivy','clair','scanning','cve','vulnerability'], related: ['cicd/pipeline-security', 'kcsa-platform-security/supply-chain-overview'] },
        { id: 'image-hardening', name: 'Image Hardening & Dockerfile Best Practices', difficulty: 'medium', path: 'cks-supply-chain/image-hardening', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['dockerfile','distroless','alpine','multi-stage','sbom'] },
        { id: 'image-signing', name: 'Image Signing & Admission Control', difficulty: 'hard', path: 'cks-supply-chain/image-signing', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['cosign','notary','signing','verification','registry'], related: ['cicd/pipeline-security'] }
      ]
    },
    // ── CKS: Monitoring, Logging and Runtime Security (20%) ─────────────
    {
      id: 'cks-runtime-security',
      name: 'Monitoring, Logging and Runtime Security',
      weight: 20, icon: '\u{1F6A8}', cert: ['cks'], type: 'cert',
      topics: [
        { id: 'falco', name: 'Falco & Runtime Threat Detection', difficulty: 'hard', path: 'cks-runtime-security/falco', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['falco','runtime','syscall','detection','alert'] },
        { id: 'audit-logging', name: 'Kubernetes Audit Logging', difficulty: 'hard', path: 'cks-runtime-security/audit-logging', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['audit','auditpolicy','logging','apiserver'], related: ['kcsa-cluster-security/control-plane-security'] },
        { id: 'container-immutability', name: 'Container Immutability & Forensics', difficulty: 'medium', path: 'cks-runtime-security/container-immutability', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['immutability','readonly','filesystem','forensics'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   KCNA — Kubernetes and Cloud Native Associate
    // ═══════════════════════════════════════════════════════════════════════

    // ── KCNA: Kubernetes Fundamentals (46%) ─────────────────────────────
    {
      id: 'kcna-k8s-fundamentals',
      name: 'Kubernetes Fundamentals',
      weight: 46, icon: '\u{2638}', cert: ['kcna'], type: 'cert',
      topics: [
        { id: 'k8s-architecture', name: 'Kubernetes Architecture Overview', difficulty: 'easy', path: 'kcna-k8s-fundamentals/k8s-architecture', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['architecture','control-plane','worker','components'] },
        { id: 'k8s-resources', name: 'Core Kubernetes Resources', difficulty: 'easy', path: 'kcna-k8s-fundamentals/k8s-resources', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['pod','deployment','service','namespace','configmap'] },
        { id: 'k8s-api', name: 'Kubernetes API & kubectl', difficulty: 'easy', path: 'kcna-k8s-fundamentals/k8s-api', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['api','kubectl','rest','api-groups','versioning'] },
        { id: 'containers-runtime', name: 'Containers & Container Runtimes', difficulty: 'easy', path: 'kcna-k8s-fundamentals/containers-runtime', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['container','oci','containerd','cri-o','runc'] }
      ]
    },
    // ── KCNA: Container Orchestration (22%) ─────────────────────────────
    {
      id: 'kcna-orchestration',
      name: 'Container Orchestration',
      weight: 22, icon: '\u{1F3AF}', cert: ['kcna'], type: 'cert',
      topics: [
        { id: 'orchestration-fundamentals', name: 'Container Orchestration Fundamentals', difficulty: 'easy', path: 'kcna-orchestration/orchestration-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['orchestration','scheduling','scaling','self-healing'] },
        { id: 'networking-concepts', name: 'Networking & Service Mesh Concepts', difficulty: 'medium', path: 'kcna-orchestration/networking-concepts', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['cni','service-mesh','istio','linkerd','envoy'] },
        { id: 'storage-security-concepts', name: 'Storage & Security Concepts', difficulty: 'medium', path: 'kcna-orchestration/storage-security-concepts', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['pv','pvc','rbac','pss','csi'] }
      ]
    },
    // ── KCNA: Cloud Native Architecture (16%) ───────────────────────────
    {
      id: 'kcna-cloud-native',
      name: 'Cloud Native Architecture',
      weight: 16, icon: '\u{2601}', cert: ['kcna'], type: 'cert',
      topics: [
        { id: 'cloud-native-fundamentals', name: 'Cloud Native & 12-Factor Apps', difficulty: 'easy', path: 'kcna-cloud-native/cloud-native-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['cloud-native','12-factor','microservices','cncf'] },
        { id: 'cncf-ecosystem', name: 'CNCF Ecosystem & Governance', difficulty: 'medium', path: 'kcna-cloud-native/cncf-ecosystem', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['cncf','graduated','incubating','sandbox','landscape'] },
        { id: 'open-standards', name: 'Open Standards (OCI, CNI, CSI, CRI)', difficulty: 'medium', path: 'kcna-cloud-native/open-standards', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['oci','cni','csi','cri','smi','standards'] }
      ]
    },
    // ── KCNA: Cloud Native Observability (8%) ───────────────────────────
    {
      id: 'kcna-observability',
      name: 'Cloud Native Observability',
      weight: 8, icon: '\u{1F50D}', cert: ['kcna'], type: 'cert',
      topics: [
        { id: 'observability-fundamentals', name: 'Observability: Logs, Metrics & Traces', difficulty: 'easy', path: 'kcna-observability/observability-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['observability','logs','metrics','traces','prometheus','opentelemetry'] }
      ]
    },
    // ── KCNA: Cloud Native Application Delivery (8%) ────────────────────
    {
      id: 'kcna-app-delivery',
      name: 'Cloud Native Application Delivery',
      weight: 8, icon: '\u{1F69A}', cert: ['kcna'], type: 'cert',
      topics: [
        { id: 'gitops-cicd', name: 'GitOps & CI/CD Concepts', difficulty: 'easy', path: 'kcna-app-delivery/gitops-cicd', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['gitops','cicd','argocd','flux','tekton'], related: ['argocd-fundamentals/argocd-architecture', 'fluxcd/fluxcd-fundamentals', 'cicd/github-actions'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   KCSA — Kubernetes and Cloud Native Security Associate
    // ═══════════════════════════════════════════════════════════════════════

    // ── KCSA: Overview of Cloud Native Security (14%) ───────────────────
    {
      id: 'kcsa-security-overview',
      name: 'Overview of Cloud Native Security',
      weight: 14, icon: '\u{1F30D}', cert: ['kcsa'], type: 'cert',
      topics: [
        { id: '4c-security-model', name: 'The 4C Security Model', difficulty: 'easy', path: 'kcsa-security-overview/4c-security-model', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['4c','cloud','cluster','container','code','layers'] },
        { id: 'cloud-provider-security', name: 'Cloud Provider & Infrastructure Security', difficulty: 'medium', path: 'kcsa-security-overview/cloud-provider-security', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['cloud','iam','vpc','firewall','infrastructure'] }
      ]
    },
    // ── KCSA: Kubernetes Cluster Component Security (22%) ───────────────
    {
      id: 'kcsa-cluster-security',
      name: 'Kubernetes Cluster Component Security',
      weight: 22, icon: '\u{1F3E0}', cert: ['kcsa'], type: 'cert',
      topics: [
        { id: 'control-plane-security', name: 'Control Plane Component Security', difficulty: 'medium', path: 'kcsa-cluster-security/control-plane-security', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['apiserver','etcd','scheduler','controller-manager','security'] },
        { id: 'worker-node-security', name: 'Worker Node Security', difficulty: 'medium', path: 'kcsa-cluster-security/worker-node-security', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['kubelet','kube-proxy','container-runtime','node'] },
        { id: 'k8s-networking-security', name: 'Kubernetes Networking Security', difficulty: 'medium', path: 'kcsa-cluster-security/k8s-networking-security', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['networkpolicy','cni','ingress','service','isolation'] }
      ]
    },
    // ── KCSA: Kubernetes Security Fundamentals (22%) ────────────────────
    {
      id: 'kcsa-k8s-security',
      name: 'Kubernetes Security Fundamentals',
      weight: 22, icon: '\u{1F511}', cert: ['kcsa'], type: 'cert',
      topics: [
        { id: 'pod-security-overview', name: 'Pod Security Standards Overview', difficulty: 'medium', path: 'kcsa-k8s-security/pod-security-overview', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['pss','psa','privileged','baseline','restricted'] },
        { id: 'rbac-overview', name: 'RBAC & Authentication Overview', difficulty: 'medium', path: 'kcsa-k8s-security/rbac-overview', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['rbac','role','authentication','authorization'] },
        { id: 'secrets-overview', name: 'Secrets & Data Protection', difficulty: 'medium', path: 'kcsa-k8s-security/secrets-overview', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['secrets','encryption','etcd','kms'] }
      ]
    },
    // ── KCSA: Kubernetes Threat Model (16%) ──────────────────────────────
    {
      id: 'kcsa-threat-model',
      name: 'Kubernetes Threat Model',
      weight: 16, icon: '\u{26A0}', cert: ['kcsa'], type: 'cert',
      topics: [
        { id: 'threat-modeling', name: 'STRIDE & Kubernetes Threat Modeling', difficulty: 'medium', path: 'kcsa-threat-model/threat-modeling', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['stride','threat','attack','vector','surface'] },
        { id: 'attack-vectors', name: 'Common Attack Vectors & Mitigations', difficulty: 'hard', path: 'kcsa-threat-model/attack-vectors', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['attack','privilege-escalation','container-escape','supply-chain'] }
      ]
    },
    // ── KCSA: Platform Security (16%) ───────────────────────────────────
    {
      id: 'kcsa-platform-security',
      name: 'Platform Security',
      weight: 16, icon: '\u{1F6E1}', cert: ['kcsa'], type: 'cert',
      topics: [
        { id: 'supply-chain-overview', name: 'Supply Chain Security Overview', difficulty: 'medium', path: 'kcsa-platform-security/supply-chain-overview', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['supply-chain','sbom','image-scanning','signing'] },
        { id: 'admission-controllers-overview', name: 'Admission Controllers & Policy Engines', difficulty: 'medium', path: 'kcsa-platform-security/admission-controllers-overview', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['admission','opa','gatekeeper','kyverno','policy'] }
      ]
    },
    // ── KCSA: Compliance and Security Frameworks (10%) ──────────────────
    {
      id: 'kcsa-compliance',
      name: 'Compliance and Security Frameworks',
      weight: 10, icon: '\u{1F4CB}', cert: ['kcsa'], type: 'cert',
      topics: [
        { id: 'compliance-frameworks', name: 'Compliance Frameworks & CIS Benchmarks', difficulty: 'easy', path: 'kcsa-compliance/compliance-frameworks', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['compliance','cis','nist','soc2','hipaa','benchmark'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   AWS — Cloud Practitioner (CLF-C02)
    // ═══════════════════════════════════════════════════════════════════════

    // ── CLF: Cloud Concepts (24%) ───────────────────────────────────────
    {
      id: 'aws-cloud-concepts',
      name: 'Cloud Concepts',
      weight: 24, icon: '\u{2601}', cert: ['aws-clf'], type: 'cert',
      topics: [
        { id: 'cloud-fundamentals', name: 'Cloud Computing Fundamentals', difficulty: 'easy', path: 'aws-cloud-concepts/cloud-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['cloud','iaas','paas','saas','deployment-models','benefits','well-architected'] },
        { id: 'aws-global-infra', name: 'AWS Global Infrastructure', difficulty: 'easy', path: 'aws-cloud-concepts/aws-global-infra', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['regions','availability-zones','edge-locations','local-zones','wavelength','outposts'] }
      ]
    },
    // ── CLF: Security and Compliance (30%) ──────────────────────────────
    {
      id: 'aws-security-compliance',
      name: 'Security and Compliance',
      weight: 30, icon: '\u{1F512}', cert: ['aws-clf'], type: 'cert',
      topics: [
        { id: 'iam-basics', name: 'IAM Fundamentals', difficulty: 'easy', path: 'aws-security-compliance/iam-basics', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['iam','users','groups','policies','roles','mfa','root-account','least-privilege'] },
        { id: 'shared-responsibility', name: 'Shared Responsibility Model', difficulty: 'easy', path: 'aws-security-compliance/shared-responsibility', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['shared-responsibility','compliance','artifact','config','guardduty','inspector','macie'] }
      ]
    },
    // ── CLF: Cloud Technology and Services (34%) ────────────────────────
    {
      id: 'aws-technology-services',
      name: 'Cloud Technology and Services',
      weight: 34, icon: '\u{1F5A5}', cert: ['aws-clf'], type: 'cert',
      topics: [
        { id: 'compute-services', name: 'Compute Services', difficulty: 'easy', path: 'aws-technology-services/compute-services', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['ec2','lambda','ecs','fargate','lightsail','beanstalk','batch'] },
        { id: 'storage-databases', name: 'Storage & Database Services', difficulty: 'easy', path: 'aws-technology-services/storage-databases', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['s3','ebs','efs','rds','dynamodb','aurora','elasticache','redshift'] },
        { id: 'networking-cdn', name: 'Networking & Content Delivery', difficulty: 'medium', path: 'aws-technology-services/networking-cdn', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['vpc','subnets','route53','cloudfront','api-gateway','direct-connect','transit-gateway'] },
        { id: 'management-governance', name: 'Management & Governance', difficulty: 'easy', path: 'aws-technology-services/management-governance', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['cloudwatch','cloudtrail','systems-manager','trusted-advisor','organizations','config'] }
      ]
    },
    // ── CLF: Billing, Pricing and Support (12%) ─────────────────────────
    {
      id: 'aws-billing-pricing',
      name: 'Billing, Pricing and Support',
      weight: 12, icon: '\u{1F4B0}', cert: ['aws-clf'], type: 'cert',
      topics: [
        { id: 'pricing-support', name: 'Pricing Models & Support Plans', difficulty: 'easy', path: 'aws-billing-pricing/pricing-support', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['free-tier','on-demand','reserved','spot','savings-plans','cost-explorer','budgets','support-plans'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   AWS — Solutions Architect Associate (SAA-C03)
    // ═══════════════════════════════════════════════════════════════════════

    // ── SAA: Design Secure Architectures (30%) ──────────────────────────
    {
      id: 'aws-secure-arch',
      name: 'Design Secure Architectures',
      weight: 30, icon: '\u{1F510}', cert: ['aws-saa'], type: 'cert',
      topics: [
        { id: 'iam-advanced', name: 'IAM Advanced & Organizations', difficulty: 'medium', path: 'aws-secure-arch/iam-advanced', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['iam','organizations','scp','sso','identity-center','sts','federation','cross-account'] },
        { id: 'data-protection', name: 'Data Protection & Encryption', difficulty: 'medium', path: 'aws-secure-arch/data-protection', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['kms','cloudhsm','acm','secrets-manager','ssm-parameter','encryption-at-rest','in-transit'] },
        { id: 'network-security', name: 'Network Security', difficulty: 'hard', path: 'aws-secure-arch/network-security', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['security-groups','nacls','waf','shield','firewall-manager','vpn','direct-connect','privatelink'] }
      ]
    },
    // ── SAA: Design Resilient Architectures (26%) ───────────────────────
    {
      id: 'aws-resilient-arch',
      name: 'Design Resilient Architectures',
      weight: 26, icon: '\u{1F3D7}', cert: ['aws-saa'], type: 'cert',
      topics: [
        { id: 'ha-fault-tolerance', name: 'High Availability & Fault Tolerance', difficulty: 'medium', path: 'aws-resilient-arch/ha-fault-tolerance', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['multi-az','asg','elb','alb','nlb','route53-failover','rds-multi-az'] },
        { id: 'decoupled-arch', name: 'Decoupled & Event-Driven Architectures', difficulty: 'hard', path: 'aws-resilient-arch/decoupled-arch', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['sqs','sns','eventbridge','step-functions','kinesis','mq','decoupling'] },
        { id: 'backup-recovery', name: 'Backup & Disaster Recovery', difficulty: 'medium', path: 'aws-resilient-arch/backup-recovery', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['aws-backup','dr-strategies','pilot-light','warm-standby','active-active','rpo','rto'] }
      ]
    },
    // ── SAA: Design High-Performing Architectures (24%) ─────────────────
    {
      id: 'aws-high-perf-arch',
      name: 'Design High-Performing Architectures',
      weight: 24, icon: '\u{26A1}', cert: ['aws-saa'], type: 'cert',
      topics: [
        { id: 'compute-optimization', name: 'Compute & Container Optimization', difficulty: 'hard', path: 'aws-high-perf-arch/compute-optimization', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['ec2-types','placement-groups','ecs','eks','fargate','lambda-perf','graviton'] },
        { id: 'storage-optimization', name: 'Storage & Caching Optimization', difficulty: 'medium', path: 'aws-high-perf-arch/storage-optimization', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['s3-classes','ebs-types','efs','fsx','elasticache','dax','cloudfront-caching'] },
        { id: 'database-optimization', name: 'Database Selection & Optimization', difficulty: 'hard', path: 'aws-high-perf-arch/database-optimization', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['rds','aurora','dynamodb','elasticache','redshift','neptune','documentdb','read-replicas'] }
      ]
    },
    // ── SAA: Design Cost-Optimized Architectures (20%) ──────────────────
    {
      id: 'aws-cost-optimized',
      name: 'Design Cost-Optimized Architectures',
      weight: 20, icon: '\u{1F4B5}', cert: ['aws-saa'], type: 'cert',
      topics: [
        { id: 'cost-management', name: 'Cost Optimization Strategies', difficulty: 'medium', path: 'aws-cost-optimized/cost-management', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['reserved-instances','savings-plans','spot','compute-optimizer','s3-lifecycle','right-sizing','cost-explorer'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   AWS — Solutions Architect Professional (SAP-C02)
    // ═══════════════════════════════════════════════════════════════════════

    // ── SAP: Design for Organizational Complexity (26%) ─────────────────
    {
      id: 'aws-org-complexity',
      name: 'Design for Organizational Complexity',
      weight: 26, icon: '\u{1F3E2}', cert: ['aws-sap'], type: 'cert',
      topics: [
        { id: 'multi-account', name: 'Multi-Account Strategy & Governance', difficulty: 'hard', path: 'aws-org-complexity/multi-account', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['organizations','control-tower','scp','landing-zone','cross-account','ram','service-catalog'] },
        { id: 'hybrid-networking', name: 'Hybrid & Multi-Region Networking', difficulty: 'hard', path: 'aws-org-complexity/hybrid-networking', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['transit-gateway','direct-connect','site-to-site-vpn','privatelink','peering','global-accelerator','network-firewall'] },
        { id: 'cost-optimization-pro', name: 'Advanced Cost Optimization', difficulty: 'hard', path: 'aws-org-complexity/cost-optimization-pro', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['savings-plans','reserved-instances','spot-instances','mixed-instances','cost-anomaly-detection','cost-allocation-tags','rightsizing','s3-lifecycle','compute-optimizer','budgets','ri-marketplace'] }
      ]
    },
    // ── SAP: Design for New Solutions (29%) ──────────────────────────────
    {
      id: 'aws-new-solutions',
      name: 'Design for New Solutions',
      weight: 29, icon: '\u{1F4A1}', cert: ['aws-sap'], type: 'cert',
      topics: [
        { id: 'serverless-architecture', name: 'Serverless Architecture at Scale', difficulty: 'hard', path: 'aws-new-solutions/serverless-architecture', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['lambda','api-gateway','step-functions','dynamodb','appsync','eventbridge','sqs','sns'] },
        { id: 'containers-at-scale', name: 'Containers & Microservices at Scale', difficulty: 'hard', path: 'aws-new-solutions/containers-at-scale', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['ecs','eks','fargate','app-runner','ecr','service-mesh','app-mesh','cloud-map'] },
        { id: 'advanced-networking', name: 'Advanced Networking & Connectivity', difficulty: 'hard', path: 'aws-new-solutions/advanced-networking', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['transit-gateway','direct-connect','vpc-peering','privatelink','vpc-sharing','ram','network-firewall','security-groups','nacls','vpc-endpoints','gateway-endpoint','interface-endpoint','bgp'] }
      ]
    },
    // ── SAP: Continuous Improvement (25%) ────────────────────────────────
    {
      id: 'aws-continuous-improvement',
      name: 'Continuous Improvement for Existing Solutions',
      weight: 25, icon: '\u{1F504}', cert: ['aws-sap'], type: 'cert',
      topics: [
        { id: 'monitoring-optimization', name: 'Monitoring, Logging & Optimization', difficulty: 'hard', path: 'aws-continuous-improvement/monitoring-optimization', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['cloudwatch','x-ray','config','trusted-advisor','compute-optimizer','well-architected-tool'] },
        { id: 'operational-excellence', name: 'Operational Excellence & Automation', difficulty: 'hard', path: 'aws-continuous-improvement/operational-excellence', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['systems-manager','cloudformation','cdk','service-catalog','proton','codepipeline','codebuild'] }
      ]
    },
    // ── SAP: Workload Migration & Modernization (20%) ───────────────────
    {
      id: 'aws-migration',
      name: 'Workload Migration & Modernization',
      weight: 20, icon: '\u{1F69A}', cert: ['aws-sap'], type: 'cert',
      topics: [
        { id: 'migration-strategies', name: 'Migration Strategies & Tools', difficulty: 'hard', path: 'aws-migration/migration-strategies', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['7rs','mgn','dms','sct','datasync','transfer-family','snow-family','app2container'] },
        { id: 'modernization-patterns', name: 'Application Modernization', difficulty: 'hard', path: 'aws-migration/modernization-patterns', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['strangler-fig','microservices','serverless','containers','refactoring','event-driven','cqrs'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   SKILL TRACKS — Lateral Skills Beyond K8s Certifications
    // ═══════════════════════════════════════════════════════════════════════

    // ── Prometheus & Monitoring Stack ────────────────────────────────────
    {
      id: 'prom-fundamentals',
      name: 'Prometheus Fundamentals',
      weight: 0, icon: '\u{1F525}', track: ['prometheus'], type: 'skill',
      topics: [
        { id: 'prom-architecture', name: 'Prometheus Architecture & Components', difficulty: 'easy', path: 'prom-fundamentals/prom-architecture', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['prometheus','tsdb','scrape','pull-model','architecture'] },
        { id: 'promql-basics', name: 'PromQL Fundamentals', difficulty: 'medium', path: 'prom-fundamentals/promql-basics', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['promql','instant-vector','range-vector','functions','selectors'] },
        { id: 'promql-advanced', name: 'Advanced PromQL Patterns', difficulty: 'hard', path: 'prom-fundamentals/promql-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['promql','recording-rules','histogram','subquery','anti-patterns'] },
        { id: 'prom-alerting', name: 'Alertmanager & Alert Routing', difficulty: 'medium', path: 'prom-fundamentals/prom-alerting', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['alertmanager','routing','silences','inhibition','notification'], related: ['sre-fundamentals/sre-incident-mgmt', 'prom-grafana/grafana-alerting'] },
        { id: 'prom-service-discovery', name: 'Service Discovery & Relabeling', difficulty: 'medium', path: 'prom-fundamentals/prom-service-discovery', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['relabel','service-discovery','kubernetes-sd','targets'] },
        { id: 'prom-exporters', name: 'Exporters & Instrumentation', difficulty: 'medium', path: 'prom-fundamentals/prom-exporters', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['exporter','node-exporter','kube-state-metrics','custom-metrics'] }
      ]
    },
    {
      id: 'prom-grafana',
      name: 'Grafana & Visualization',
      weight: 0, icon: '\u{1F4CA}', track: ['prometheus'], type: 'skill',
      topics: [
        { id: 'grafana-dashboards', name: 'Grafana Dashboards & Panels', difficulty: 'medium', path: 'prom-grafana/grafana-dashboards', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['grafana','dashboard','panel','variable','provisioning'] },
        { id: 'grafana-alerting', name: 'Grafana Alerting & Unified Alerting', difficulty: 'medium', path: 'prom-grafana/grafana-alerting', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['grafana','alerting','contact-points','notification-policies'] }
      ]
    },

    // ── ArgoCD & GitOps ─────────────────────────────────────────────────
    {
      id: 'argocd-fundamentals',
      name: 'ArgoCD Fundamentals',
      weight: 0, icon: '\u{1F419}', track: ['argocd'], type: 'skill',
      topics: [
        { id: 'argocd-architecture', name: 'ArgoCD Architecture & GitOps', difficulty: 'easy', path: 'argocd-fundamentals/argocd-architecture', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['argocd','gitops','architecture','reconciliation','pull-model'], related: ['fluxcd/fluxcd-fundamentals', 'platform-engineering/idp-concepts'] },
        { id: 'argocd-applications', name: 'Applications & Source Types', difficulty: 'medium', path: 'argocd-fundamentals/argocd-applications', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['application','helm','kustomize','directory','multiple-sources'] },
        { id: 'argocd-sync-strategies', name: 'Sync Strategies & Hooks', difficulty: 'medium', path: 'argocd-fundamentals/argocd-sync-strategies', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['sync','auto-sync','prune','self-heal','waves','hooks'] },
        { id: 'argocd-projects', name: 'AppProjects, RBAC & SSO', difficulty: 'hard', path: 'argocd-fundamentals/argocd-projects', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['appproject','rbac','casbin','sync-windows','sso','dex'] }
      ]
    },
    {
      id: 'argocd-patterns',
      name: 'ArgoCD Patterns & Operations',
      weight: 0, icon: '\u{1F3AF}', track: ['argocd'], type: 'skill',
      topics: [
        { id: 'argocd-app-of-apps', name: 'App of Apps & ApplicationSets', difficulty: 'hard', path: 'argocd-patterns/argocd-app-of-apps', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['app-of-apps','applicationset','generators','cluster-generator','git-generator'] },
        { id: 'argocd-advanced', name: 'Multi-Cluster, Notifications & Image Updater', difficulty: 'hard', path: 'argocd-patterns/argocd-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['multi-cluster','notifications','image-updater','disaster-recovery','best-practices'] }
      ]
    },

    // ── SRE Practices & Reliability ─────────────────────────────────────
    {
      id: 'sre-fundamentals',
      name: 'SRE Fundamentals',
      weight: 0, icon: '\u{1F4C8}', track: ['sre-practices'], type: 'skill',
      topics: [
        { id: 'sre-principles', name: 'SLIs, SLOs, SLAs & Error Budgets', difficulty: 'medium', path: 'sre-fundamentals/sre-principles', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['sli','slo','sla','error-budget','burn-rate','reliability'] },
        { id: 'sre-observability', name: 'Observability & Monitoring Strategy', difficulty: 'medium', path: 'sre-fundamentals/sre-observability', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['observability','metrics','logs','traces','use-method','red-method','golden-signals'] },
        { id: 'sre-incident-mgmt', name: 'Incident Management & Postmortems', difficulty: 'hard', path: 'sre-fundamentals/sre-incident-mgmt', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['incident','postmortem','blameless','severity','mttr','mttd'] },
        { id: 'sre-capacity-planning', name: 'Capacity Planning & Demand Forecasting', difficulty: 'hard', path: 'sre-fundamentals/sre-capacity-planning', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['capacity-planning','predict-linear','vpa','demand-forecasting','headroom','right-sizing','load-testing','k6','oom','memory-planning'] }
      ]
    },
    {
      id: 'sre-operations',
      name: 'SRE Operations',
      weight: 0, icon: '\u{1F6E0}', track: ['sre-practices'], type: 'skill',
      topics: [
        { id: 'sre-oncall', name: 'On-Call, Runbooks & Escalation', difficulty: 'medium', path: 'sre-operations/sre-oncall', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['oncall','runbook','escalation','pagerduty','rotation','handoff'] },
        { id: 'sre-toil-automation', name: 'Toil Elimination & Automation', difficulty: 'medium', path: 'sre-operations/sre-toil-automation', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['toil','automation','hpa','cronjob','self-healing','gitops'] },
        { id: 'sre-capacity', name: 'Capacity Planning & Performance', difficulty: 'hard', path: 'sre-operations/sre-capacity', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['capacity','requests','limits','vpa','hpa','rightsizing','cost-optimization'] },
        { id: 'sre-deployment-safety', name: 'Deployment Safety & Progressive Delivery', difficulty: 'hard', path: 'sre-operations/sre-deployment-safety', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['canary','blue-green','progressive-delivery','feature-flags','argo-rollouts','openfeature','flagd','smoke-tests','rollback','deployment-frequency'] }
      ]
    },

    // ── Cilium & eBPF Networking ────────────────────────────────────────
    {
      id: 'cilium-fundamentals',
      name: 'Cilium Fundamentals',
      weight: 0, icon: '\u{1F41D}', track: ['cilium'], type: 'skill',
      topics: [
        { id: 'cilium-architecture', name: 'Cilium Architecture & eBPF', difficulty: 'easy', path: 'cilium-fundamentals/cilium-architecture', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['cilium','ebpf','cni','identity','kube-proxy-replacement','architecture'] },
        { id: 'cilium-network-policies', name: 'CiliumNetworkPolicy & L7 Security', difficulty: 'medium', path: 'cilium-fundamentals/cilium-network-policies', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['ciliumnetworkpolicy','l7','fqdn','http','kafka','identity-aware'], related: ['cks-cluster-setup/ingress-tls'] },
        { id: 'cilium-hubble', name: 'Hubble Observability', difficulty: 'medium', path: 'cilium-fundamentals/cilium-hubble', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['hubble','flows','service-map','dns','metrics','observability'], related: ['opentelemetry/otel-fundamentals'] }
      ]
    },
    {
      id: 'cilium-advanced',
      name: 'Cilium Advanced',
      weight: 0, icon: '\u{1F9EC}', track: ['cilium'], type: 'skill',
      topics: [
        { id: 'cilium-service-mesh', name: 'Service Mesh & Gateway API', difficulty: 'hard', path: 'cilium-advanced/cilium-service-mesh', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['service-mesh','gateway-api','mtls','envoy','traffic-splitting','sidecar-free'] },
        { id: 'cilium-bgp-lb', name: 'BGP & Load Balancing', difficulty: 'hard', path: 'cilium-advanced/cilium-bgp-lb', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['bgp','lb-ipam','dsr','maglev','xdp','loadbalancer'] },
        { id: 'cilium-cluster-mesh', name: 'ClusterMesh & Multi-Cluster', difficulty: 'hard', path: 'cilium-advanced/cilium-cluster-mesh', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['clustermesh','multi-cluster','global-service','failover','disaster-recovery'] },
        { id: 'cilium-tetragon', name: 'Tetragon: Runtime Security', difficulty: 'hard', path: 'cilium-advanced/cilium-tetragon', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['tetragon','ebpf','runtime-security','tracingpolicy','enforcement','observability'], related: ['cilium-fundamentals/cilium-architecture', 'cks-runtime-security/falco', 'cilium-fundamentals/cilium-hubble'] },
        { id: 'cilium-encryption', name: 'Transparent Encryption (WireGuard/IPsec)', difficulty: 'hard', path: 'cilium-advanced/cilium-encryption', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['wireguard','ipsec','encryption','transparent-encryption','compliance','zero-trust'], related: ['cilium-fundamentals/cilium-architecture', 'cks-cluster-setup/ingress-tls', 'services-networking/network-policies'] },
        { id: 'cilium-egress-gateway', name: 'Egress Gateway (Static Egress IP)', difficulty: 'hard', path: 'cilium-advanced/cilium-egress-gateway', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['egress-gateway','egress-ip','snat','static-ip','firewall','allowlist'], related: ['cilium-fundamentals/cilium-network-policies', 'services-networking/services', 'cilium-fundamentals/cilium-architecture'] }
      ]
    },

    // ── Istio Service Mesh ────────────────────────────────────────────────
    {
      id: 'istio-fundamentals',
      name: 'Istio Fundamentals',
      weight: 0, icon: '\u{1F578}', track: ['istio'], type: 'skill',
      topics: [
        { id: 'istio-architecture', name: 'Istio Architecture & Installation', difficulty: 'easy', path: 'istio-fundamentals/istio-architecture', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['istio','istiod','envoy','sidecar','control-plane','data-plane','injection'] },
        { id: 'istio-traffic-mgmt', name: 'Traffic Management', difficulty: 'medium', path: 'istio-fundamentals/istio-traffic-mgmt', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['virtualservice','destinationrule','routing','retries','timeout','fault-injection','traffic-shifting'] },
        { id: 'istio-gateway', name: 'Gateways & Ingress', difficulty: 'medium', path: 'istio-fundamentals/istio-gateway', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['gateway','ingress-gateway','egress-gateway','tls','https','sni'] }
      ]
    },
    {
      id: 'istio-advanced',
      name: 'Istio Advanced',
      weight: 0, icon: '\u{1F310}', track: ['istio'], type: 'skill',
      topics: [
        { id: 'istio-security', name: 'Security & mTLS', difficulty: 'hard', path: 'istio-advanced/istio-security', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['mtls','peerauthentication','authorizationpolicy','requestauthentication','jwt','spiffe'] },
        { id: 'istio-observability', name: 'Observability & Telemetry', difficulty: 'medium', path: 'istio-advanced/istio-observability', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kiali','jaeger','tracing','metrics','access-log','telemetry-api'] },
        { id: 'istio-advanced-patterns', name: 'Advanced Traffic Patterns', difficulty: 'hard', path: 'istio-advanced/istio-advanced-patterns', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['canary','circuit-breaker','mirroring','locality-lb','service-entry','multi-cluster','wasm'] },
        { id: 'istio-ambient', name: 'Ambient Mesh (sidecar-less)', difficulty: 'hard', path: 'istio-advanced/istio-ambient', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['ambient','ztunnel','waypoint','hbone','sidecar-less','gateway-api'] }
      ]
    },

    // ── Security Tooling ──────────────────────────────────────────────────
    {
      id: 'security-tooling',
      name: 'Security Tooling',
      weight: 0, icon: '\u{1F510}', track: ['security-tooling'], type: 'skill',
      topics: [
        { id: 'vault-k8s', name: 'HashiCorp Vault & Kubernetes', difficulty: 'hard', path: 'security-tooling/vault-k8s', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['vault','secrets','agent-injector','csi-driver','pki','dynamic-secrets','encryption'] },
        { id: 'cert-manager', name: 'cert-manager & TLS Automation', difficulty: 'medium', path: 'security-tooling/cert-manager', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['cert-manager','tls','letsencrypt','acme','clusterissuer','certificate','x509'], related: ['cks-cluster-setup/ingress-tls'] },
        { id: 'external-secrets', name: 'External Secrets Operator', difficulty: 'medium', path: 'security-tooling/external-secrets', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['external-secrets','eso','aws-sm','vault','azure-kv','gcp-sm','secretstore'] }
      ]
    },

    // ── Platform Engineering ──────────────────────────────────────────────
    {
      id: 'platform-engineering',
      name: 'Platform Engineering',
      weight: 0, icon: '\u{1F3D7}', track: ['platform-eng'], type: 'skill',
      topics: [
        { id: 'idp-concepts', name: 'Internal Developer Platforms', difficulty: 'easy', path: 'platform-engineering/idp-concepts', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['idp','platform-engineering','self-service','developer-experience','team-topologies','thinnest-viable-platform'], related: ['platform-engineering/backstage'] },
        { id: 'backstage', name: 'Backstage Developer Portal', difficulty: 'medium', path: 'platform-engineering/backstage', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['backstage','spotify','software-catalog','templates','techdocs','plugins','scaffolder'] },
        { id: 'golden-paths', name: 'Golden Paths & Self-Service', difficulty: 'medium', path: 'platform-engineering/golden-paths', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['golden-path','self-service','platform-api','crossplane','argocd','gitops','developer-portal'] },
        { id: 'platform-metrics', name: 'Platform Metrics: DORA, SPACE & DevEx', difficulty: 'medium', path: 'platform-engineering/platform-metrics', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['dora','space','deployment-frequency','lead-time','change-failure-rate','mttr','developer-experience','devex','platform-kpis','developer-satisfaction'] }
      ]
    },
    {
      id: 'iac',
      name: 'Infrastructure as Code',
      weight: 0, icon: '\u{2699}', track: ['iac'], type: 'skill',
      topics: [
        { id: 'terraform-fundamentals', name: 'Terraform Fundamentals', difficulty: 'medium', path: 'iac/terraform-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['terraform','hcl','providers','state','plan','apply','modules','iac'] },
        { id: 'terraform-k8s', name: 'Terraform & Kubernetes', difficulty: 'hard', path: 'iac/terraform-k8s', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['terraform','kubernetes','eks','gke','aks','helm-provider','kubernetes-provider'], related: ['crossplane/crossplane-fundamentals', 'platform-engineering/idp-concepts'] },
        { id: 'terraform-patterns', name: 'Terraform Advanced Patterns', difficulty: 'hard', path: 'iac/terraform-patterns', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['terraform','modules','workspaces','remote-state','atlantis','terragrunt','ci-cd','drift'] },
        { id: 'terraform-testing', name: 'Terraform Testing & Quality Gates', difficulty: 'hard', path: 'iac/terraform-testing', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['terraform','testing','checkov','tflint','terratest','terraform-test','security-scanning','quality-gates','pre-commit','sarif'] }
      ]
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Skill Track: Helm Chart Development
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'helm',
      name: 'Helm Chart Development',
      weight: 0, icon: '\u{26F5}', track: ['helm-advanced'], type: 'skill',
      topics: [
        { id: 'helm-chart-development', name: 'Helm Chart Development', difficulty: 'medium', path: 'helm/helm-chart-development', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['helm','chart','templates','values','helpers','hooks','tests','toYaml','nindent','go-template','sprig','packaging'], related: ['app-deployment/helm', 'argocd-fundamentals/argocd-applications', 'fluxcd/fluxcd-sources'] },
        { id: 'helm-advanced', name: 'Helm Avançado: OCI, Library Charts & CI/CD', difficulty: 'hard', path: 'helm/helm-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['helm','oci-registry','library-chart','subcharts','dependencies','values-schema','helm-test','ci-cd','github-actions','harbor','ecr'] }
      ]
    },
    {
      id: 'opentelemetry',
      name: 'OpenTelemetry',
      weight: 0, icon: '\u{1F52D}', track: ['otel'], type: 'skill',
      topics: [
        { id: 'otel-fundamentals', name: 'OpenTelemetry Fundamentals', difficulty: 'medium', path: 'opentelemetry/otel-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['opentelemetry','otel','traces','metrics','logs','signals','sdk','collector','otlp'] },
        { id: 'otel-collector', name: 'OTel Collector & Pipelines', difficulty: 'hard', path: 'opentelemetry/otel-collector', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['otel-collector','receivers','processors','exporters','pipelines','filelog','batch','memory-limiter'] },
        { id: 'otel-k8s', name: 'OpenTelemetry on Kubernetes', difficulty: 'hard', path: 'opentelemetry/otel-k8s', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['otel-operator','auto-instrumentation','sidecar','daemonset','k8sattributes','jaeger','tempo','loki'] }
      ]
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Skill Track: Chaos Engineering
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'chaos-engineering',
      name: 'Chaos Engineering',
      weight: 0, icon: '\u{1F300}', track: ['chaos-eng'], type: 'skill',
      topics: [
        { id: 'chaos-fundamentals', name: 'Chaos Engineering Fundamentals', difficulty: 'medium', path: 'chaos-engineering/chaos-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['chaos-engineering','principles','steady-state','blast-radius','gameday','resilience'], related: ['sre-fundamentals/sre-principles'] },
        { id: 'litmus-chaos', name: 'LitmusChaos on Kubernetes', difficulty: 'hard', path: 'chaos-engineering/litmus-chaos', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['litmus','chaosexperiment','chaosengine','chaosresult','probes','workflows','hub'] },
        { id: 'chaos-mesh', name: 'Chaos Mesh on Kubernetes', difficulty: 'hard', path: 'chaos-engineering/chaos-mesh', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['chaos-mesh','podchaos','networkchaos','iochaos','stresschaos','schedule','workflow'] }
      ]
    },
    // ═══════════════════════════════════════════════════════════════════════
    // Skill Track: Crossplane
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'crossplane',
      name: 'Crossplane & Platform APIs',
      weight: 0, icon: '\u{2693}', track: ['crossplane'], type: 'skill',
      topics: [
        { id: 'crossplane-fundamentals', name: 'Crossplane Fundamentals', difficulty: 'medium', path: 'crossplane/crossplane-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['crossplane','control-plane','providers','managed-resources','composite','xrd','cncf'], related: ['platform-engineering/golden-paths', 'cluster-architecture/crds-operators'] },
        { id: 'crossplane-providers', name: 'Crossplane Providers & MRs', difficulty: 'hard', path: 'crossplane/crossplane-providers', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['provider-aws','provider-gcp','provider-azure','managed-resources','providerconfig','s3','rds','vpc'] },
        { id: 'crossplane-compositions', name: 'Compositions & XRDs', difficulty: 'hard', path: 'crossplane/crossplane-compositions', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['xrd','composition','compositeresource','claim','patches','transforms','pipeline-mode','function'] }
      ]
    },
    {
      id: 'kyverno',
      name: 'Kyverno Policy Engine',
      weight: 0, icon: '\u{1F4DC}', track: ['kyverno'], type: 'skill',
      topics: [
        { id: 'kyverno-fundamentals', name: 'Kyverno Fundamentals', difficulty: 'medium', path: 'kyverno/kyverno-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kyverno','clusterpolicy','policy','validate','mutate','generate','admission-webhook','cncf'] },
        { id: 'kyverno-policies', name: 'Validate, Mutate & Generate', difficulty: 'hard', path: 'kyverno/kyverno-policies', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['validate','mutate','generate','pattern','deny','foreach','context','jmespath','preconditions'] },
        { id: 'kyverno-advanced', name: 'Policy Exceptions & Testing', difficulty: 'hard', path: 'kyverno/kyverno-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['policyexception','kyverno-cli','test','reports','policyreport','metrics','verify-images','cosign'] }
      ]
    },
    {
      id: 'fluxcd',
      name: 'FluxCD & GitOps',
      weight: 0, icon: '\u{1F30A}', track: ['fluxcd'], type: 'skill',
      topics: [
        { id: 'fluxcd-fundamentals', name: 'FluxCD & GitOps Fundamentals', difficulty: 'medium', path: 'fluxcd/fluxcd-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['fluxcd','gitops','source-controller','kustomize-controller','helm-controller','cncf','reconciliation'] },
        { id: 'fluxcd-sources', name: 'Sources, Kustomizations & Helm', difficulty: 'hard', path: 'fluxcd/fluxcd-sources', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['gitrepository','helmrepository','helmrelease','kustomization','ocirepository','substitution','dependson'] },
        { id: 'fluxcd-advanced', name: 'Image Automation & Notifications', difficulty: 'hard', path: 'fluxcd/fluxcd-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['image-automation','imagepolicy','imagerepository','imageupdateautomation','alerts','providers','receivers','multi-tenancy'] }
      ]
    },
    {
      id: 'kong',
      name: 'Kong API Gateway',
      weight: 0, icon: '\u{1F98D}', track: ['kong'], type: 'skill',
      topics: [
        { id: 'kong-fundamentals', name: 'Kong Gateway Fundamentals', difficulty: 'medium', path: 'kong/kong-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kong','api-gateway','ingress','kubernetes-ingress-controller','kic','service','route','upstream'] },
        { id: 'kong-plugins', name: 'Kong Plugins & Traffic Control', difficulty: 'hard', path: 'kong/kong-plugins', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['plugins','rate-limiting','authentication','key-auth','jwt','oauth2','cors','request-transformer','proxy-cache'] },
        { id: 'kong-advanced', name: 'Kong Mesh, Observability & Production', difficulty: 'hard', path: 'kong/kong-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['deck','konnect','gateway-api','httproute','grpcroute','canary','blue-green','prometheus','opentelemetry'] }
      ]
    },
    {
      id: 'ai-engineering',
      name: 'AI Engineering para DevOps/SRE',
      weight: 0, icon: '\u{1F916}', track: ['ai-engineering'], type: 'skill',
      topics: [
        { id: 'llm-fundamentals', name: 'Fundamentos Práticos de LLMs', difficulty: 'easy', path: 'ai-engineering/llm-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['llm','openai','anthropic','claude','gpt','tokens','context','prompt-engineering','modelos'] },
        { id: 'copilot-devops', name: 'GitHub Copilot para DevOps & Infra', difficulty: 'medium', path: 'ai-engineering/copilot-devops', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['copilot','github-copilot','copilot-cli','iac','terraform','kubernetes','yaml','vscode','jetbrains'] },
        { id: 'claude-code-platform', name: 'Claude Code & Agentes para Plataforma', difficulty: 'hard', path: 'ai-engineering/claude-code-platform', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['claude-code','mcp','agents','skills','agentic','workflow','automation','claude','anthropic'] },
        { id: 'rag-platform', name: 'RAG: Documentação e Runbooks', difficulty: 'medium', path: 'ai-engineering/rag-platform', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['rag','vector-db','embeddings','chroma','qdrant','langchain','runbooks','documentation','knowledge-base'] },
        { id: 'llm-harness', name: 'LLM Harness & Avaliação', difficulty: 'hard', path: 'ai-engineering/llm-harness', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['evaluation','harness','langfuse','evals','observability','tracing','cost','prompt-testing','ragas'] },
        { id: 'sdd-cases', name: 'Spec Driven Development & Cases Reais', difficulty: 'hard', path: 'ai-engineering/sdd-cases', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['sdd','spec-driven','aiops','incident-response','postmortem','iac-generation','chatops','automation'] }
      ]
    },
    {
      id: 'docker',
      name: 'Docker & Containers',
      weight: 0, icon: '\u{1F433}', track: ['docker'], type: 'skill',
      topics: [
        { id: 'container-fundamentals', name: 'Container Fundamentals', difficulty: 'easy', path: 'docker/container-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['docker','dockerfile','layers','multi-stage','buildkit','images','containers','oci'] },
        { id: 'docker-compose', name: 'Docker Compose & Dev Workflows', difficulty: 'easy', path: 'docker/docker-compose', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['docker-compose','volumes','networks','profiles','override','dev-environment','services'] },
        { id: 'docker-production', name: 'Docker em Produção', difficulty: 'medium', path: 'docker/docker-production', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['buildkit','trivy','cosign','harbor','registry','scanning','signing','sbom','supply-chain'] }
      ]
    },
    {
      id: 'cicd',
      name: 'CI/CD Pipelines',
      weight: 0, icon: '\u{1F680}', track: ['cicd'], type: 'skill',
      topics: [
        { id: 'github-actions', name: 'GitHub Actions para K8s & Plataforma', difficulty: 'medium', path: 'cicd/github-actions', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['github-actions','workflows','runners','secrets','oidc','reusable-workflows','environments','matrix'] },
        { id: 'tekton', name: 'Tekton Pipelines', difficulty: 'hard', path: 'cicd/tekton', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['tekton','pipeline','task','pipelinerun','workspace','triggers','tekton-chains','kubernetes-native'] },
        { id: 'pipeline-security', name: 'Pipeline Security & Supply Chain', difficulty: 'hard', path: 'cicd/pipeline-security', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['slsa','cosign','sbom','syft','sigstore','rekor','fulcio','attestation','provenance','supply-chain'] }
      ]
    },
    {
      id: 'loki',
      name: 'Loki & Logging Stack',
      weight: 0, icon: '\u{1F4CB}', track: ['loki'], type: 'skill',
      topics: [
        { id: 'loki-fundamentals', name: 'Loki + Promtail: Fundamentos', difficulty: 'medium', path: 'loki/loki-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['loki','promtail','grafana','log-aggregation','labels','chunks','index','storage','helm'] },
        { id: 'logql-alerting', name: 'LogQL, Alertas & Correlação', difficulty: 'hard', path: 'loki/logql-alerting', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['logql','filter','metric-query','alertmanager','recording-rules','grafana-dashboard','trace-correlation','tempo'], related: ['prom-fundamentals/prom-alerting'] }
      ]
    },
    {
      id: 'keda',
      name: 'KEDA & Event-Driven Autoscaling',
      weight: 0, icon: '⚡', track: ['keda'], type: 'skill',
      topics: [
        { id: 'keda-fundamentals', name: 'KEDA Fundamentals', difficulty: 'medium', path: 'keda/keda-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['keda','scaledobject','scaledjob','triggers','http-scaler','cron-scaler','hpa','autoscaling'] },
        { id: 'keda-advanced', name: 'KEDA Avançado: Kafka, Prometheus & Custom', difficulty: 'hard', path: 'keda/keda-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kafka-scaler','prometheus-scaler','external-scaler','keda-http-addon','scaled-jobs','triggerauthentication','workload-identity'] }
      ]
    },
    {
      id: 'finops',
      name: 'FinOps & Kubernetes Cost Management',
      weight: 0, icon: '\u{1F4B0}', track: ['finops'], type: 'skill',
      topics: [
        { id: 'k8s-cost-management', name: 'Kubernetes Cost Management', difficulty: 'medium', path: 'finops/k8s-cost-management', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kubecost','goldilocks','vpa','limitrange','resourcequota','rightsizing','cost-allocation','namespace-quotas'] },
        { id: 'finops-practices', name: 'FinOps Practices & Chargeback', difficulty: 'hard', path: 'finops/finops-practices', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['finops','chargeback','showback','focus-standard','cost-allocation','team-billing','waste-detection','commitment-based-discounts'] }
      ]
    },
    {
      id: 'databases-k8s',
      name: 'Databases on Kubernetes',
      weight: 0, icon: '\u{1F5C4}', track: ['databases-k8s'], type: 'skill',
      topics: [
        { id: 'db-k8s-fundamentals', name: 'Databases on K8s: Fundamentos', difficulty: 'medium', path: 'databases-k8s/db-k8s-fundamentals', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['statefulset','pvc','storage-class','operators','velero','backup','restore','headless-service'], related: ['storage/pv-pvc'] },
        { id: 'postgresql-k8s', name: 'PostgreSQL on Kubernetes', difficulty: 'hard', path: 'databases-k8s/postgresql-k8s', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['cloudnativepg','cnpg','postgresql','ha','failover','pgbouncer','barman','backup','replication'] },
        { id: 'redis-k8s', name: 'Redis & Caching on Kubernetes', difficulty: 'medium', path: 'databases-k8s/redis-k8s', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['redis','redis-operator','sentinel','cluster-mode','dragonfly','valkey','caching','session-store'] }
      ]
    },
    {
      id: 'opa',
      name: 'OPA & Gatekeeper',
      weight: 0, icon: '\u{1F6E1}', track: ['opa'], type: 'skill',
      topics: [
        { id: 'opa-gatekeeper', name: 'OPA & Gatekeeper no Kubernetes', difficulty: 'hard', path: 'opa/opa-gatekeeper', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['opa','gatekeeper','constrainttemplate','rego','admission-webhook','policy','kyverno-vs-opa','audit'] },
        { id: 'opa-beyond-k8s', name: 'OPA Além do Kubernetes', difficulty: 'hard', path: 'opa/opa-beyond-k8s', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['opa','terraform','conftest','api-authorization','bundle','decision-log','rego','policy-as-code'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    // AZ-104: Microsoft Azure Administrator
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'az104-identity',
      name: 'Azure Identity & Governance',
      weight: 20, icon: '\u{1F511}', cert: ['az-104'], type: 'cert',
      topics: [
        { id: 'entra-id', name: 'Microsoft Entra ID', difficulty: 'medium', path: 'az104-identity/entra-id', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['entra-id','azure-ad','users','groups','mfa','sso','b2b','pim','sspr','tenant'] },
        { id: 'azure-rbac', name: 'Azure RBAC', difficulty: 'medium', path: 'az104-identity/azure-rbac', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['rbac','role-assignment','contributor','owner','reader','custom-role','managed-identity','scope','arm'] },
        { id: 'azure-policy', name: 'Azure Policy & Management Groups', difficulty: 'medium', path: 'az104-identity/azure-policy', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-policy','management-groups','policy-initiative','compliance','deny','audit','deployifnotexists','modify','tags','governance'] }
      ]
    },
    {
      id: 'az104-storage',
      name: 'Azure Storage Solutions',
      weight: 15, icon: '\u{1F5C4}', cert: ['az-104'], type: 'cert',
      topics: [
        { id: 'storage-accounts', name: 'Storage Accounts & Redundancy', difficulty: 'medium', path: 'az104-storage/storage-accounts', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['storage-account','lrs','zrs','grs','gzrs','ra-grs','ra-gzrs','access-tier','hot','cool','archive','lifecycle','sas','soft-delete'] },
        { id: 'blob-storage', name: 'Azure Blob Storage', difficulty: 'easy', path: 'az104-storage/blob-storage', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['blob','block-blob','append-blob','page-blob','container','sas','stored-access-policy','worm','immutability','anonymous-access'] },
        { id: 'azure-files', name: 'Azure Files & File Sync', difficulty: 'medium', path: 'az104-storage/azure-files', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-files','smb','nfs','file-sync','cloud-tiering','storage-sync-service','server-endpoint','smb-445'] }
      ]
    },
    {
      id: 'az104-compute',
      name: 'Azure Compute Resources',
      weight: 20, icon: '\u{1F4BB}', cert: ['az-104'], type: 'cert',
      topics: [
        { id: 'azure-vms', name: 'Azure Virtual Machines', difficulty: 'medium', path: 'az104-compute/azure-vms', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['vm','availability-set','availability-zone','fault-domain','update-domain','premium-ssd','ultra-disk','bastion','deallocate','vmss'] },
        { id: 'vm-scale-sets', name: 'VM Scale Sets & Autoscaling', difficulty: 'medium', path: 'az104-compute/vm-scale-sets', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['vmss','autoscaling','scale-out','scale-in','cooldown','spot-vm','rolling-update','uniform-mode','flex-mode'] },
        { id: 'app-service', name: 'Azure App Service', difficulty: 'easy', path: 'az104-compute/app-service', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['app-service','app-service-plan','deployment-slot','swap','autoscale','vnet-integration','custom-domain','ssl','always-on','webjobs'] }
      ]
    },
    {
      id: 'az104-networking',
      name: 'Azure Virtual Networking',
      weight: 20, icon: '\u{1F5E7}', cert: ['az-104'], type: 'cert',
      topics: [
        { id: 'vnet-nsg', name: 'VNet, Subnets & NSG', difficulty: 'medium', path: 'az104-networking/vnet-nsg', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['vnet','subnet','nsg','network-security-group','service-tag','asg','vnet-peering','udr','route-table','reserved-ips'] },
        { id: 'azure-lb-appgw', name: 'Load Balancer & Application Gateway', difficulty: 'medium', path: 'az104-networking/azure-lb-appgw', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['load-balancer','application-gateway','waf','l4','l7','health-probe','backend-pool','frontend-ip','traffic-manager','front-door','url-routing','ssl-termination'] },
        { id: 'vpn-expressroute', name: 'VPN Gateway & ExpressRoute', difficulty: 'hard', path: 'az104-networking/vpn-expressroute', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['vpn-gateway','expressroute','site-to-site','point-to-site','gatewaysubnet','bgp','ipsec','private-peering','hybrid-connectivity','local-network-gateway'] },
        { id: 'azure-dns', name: 'Azure DNS & Private DNS', difficulty: 'medium', path: 'az104-networking/azure-dns', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-dns','private-dns-zone','vnet-link','auto-registration','delegation','nameservers','private-endpoint','dns-resolver','privatelink'] }
      ]
    },
    {
      id: 'az104-monitor',
      name: 'Azure Monitor & Backup',
      weight: 12, icon: '\u{1F4CA}', cert: ['az-104'], type: 'cert',
      topics: [
        { id: 'azure-monitor', name: 'Azure Monitor & Log Analytics', difficulty: 'medium', path: 'az104-monitor/azure-monitor', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-monitor','log-analytics','kql','activity-log','metrics','alerts','action-group','application-insights','diagnostic-settings','azure-monitor-agent','dcr'] },
        { id: 'azure-backup', name: 'Azure Backup & Site Recovery', difficulty: 'medium', path: 'az104-monitor/azure-backup', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-backup','recovery-services-vault','backup-policy','soft-delete','rpo','rto','azure-site-recovery','asr','failover','failback','geo-redundant','cross-region-restore'] }
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    // AZ-305: Microsoft Azure Solutions Architect Expert
    // ═══════════════════════════════════════════════════════════════════════
    {
      id: 'az305-identity',
      name: 'Identity, Governance & Monitoring Design',
      weight: 28, icon: '\u{1F3DB}', cert: ['az-305'], type: 'cert',
      topics: [
        { id: 'identity-solutions', name: 'Design de Soluções de Identidade', difficulty: 'hard', path: 'az305-identity/identity-solutions', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['pim','jit','zero-trust','hybrid-identity','phs','pta','federation','conditional-access','b2b','b2c','app-registration','enterprise-app','managed-identity','identity-protection'] },
        { id: 'governance-solutions', name: 'Design de Governance & Compliance', difficulty: 'hard', path: 'az305-identity/governance-solutions', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['landing-zone','management-groups','azure-policy','tagging-strategy','secure-score','defender-for-cloud','cost-management','budgets','reservations','savings-plans','regulatory-compliance','blueprints'] },
        { id: 'monitoring-design', name: 'Design de Monitoramento & Observabilidade', difficulty: 'hard', path: 'az305-identity/monitoring-design', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-monitor','log-analytics','application-insights','kql','diagnostic-settings','metric-alerts','workbooks','sampling','workspace-strategy','data-retention','archive'] }
      ]
    },
    {
      id: 'az305-data',
      name: 'Data Storage & Integration Design',
      weight: 28, icon: '\u{1F5C3}', cert: ['az-305'], type: 'cert',
      topics: [
        { id: 'relational-nosql', name: 'Design Relacional & NoSQL', difficulty: 'hard', path: 'az305-data/relational-nosql', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['cosmos-db','azure-sql','managed-instance','elastic-pool','consistency-levels','rtu','partition-key','geo-replication','failover-groups','redis-cache','synapse','hyperscale','serverless-sql'] },
        { id: 'data-integration', name: 'Integração & Analytics de Dados', difficulty: 'hard', path: 'az305-data/data-integration', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-data-factory','adf','synapse-analytics','stream-analytics','event-hub','service-bus','data-lake','self-hosted-ir','lambda-architecture','window-functions','etl','elt','databricks'] },
        { id: 'storage-design', name: 'Design de Soluções de Storage', difficulty: 'hard', path: 'az305-data/storage-design', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['blob-storage','adls-gen2','managed-disks','lifecycle-management','worm','immutability','storage-tiers','hot-cool-archive','premium-ssd','ultra-disk','hierarchical-namespace','data-lake'] },
        { id: 'caching-messaging', name: 'Design de Caching & Messaging', difficulty: 'hard', path: 'az305-data/caching-messaging', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['redis-cache','service-bus','event-grid','event-hub','cache-aside','read-through','write-through','dead-letter','topics-subscriptions','outbox-pattern','pub-sub','fifo'] }
      ]
    },
    {
      id: 'az305-continuity',
      name: 'Business Continuity Design',
      weight: 12, icon: '\u{1F504}', cert: ['az-305'], type: 'cert',
      topics: [
        { id: 'bcdr-design', name: 'Design de BCDR', difficulty: 'hard', path: 'az305-continuity/bcdr-design', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['bcdr','rpo','rto','azure-site-recovery','asr','warm-standby','pilot-light','active-active','backup-restore','recovery-plan','test-failover','failback','geo-replication','traffic-manager'] }
      ]
    },
    {
      id: 'az305-infrastructure',
      name: 'Infrastructure Solutions Design',
      weight: 32, icon: '\u{1F3D7}', cert: ['az-305'], type: 'cert',
      topics: [
        { id: 'compute-solutions', name: 'Design de Soluções de Compute', difficulty: 'hard', path: 'az305-infrastructure/compute-solutions', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['iaas-paas-serverless','azure-functions','container-apps','aci','aks','app-service-design','vmss','azure-batch','cold-start','premium-plan','consumption-plan','durable-functions','logic-apps'] },
        { id: 'network-topology', name: 'Design de Topologia de Rede', difficulty: 'hard', path: 'az305-infrastructure/network-topology', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['hub-spoke','virtual-wan','vwan','azure-firewall','nva','private-endpoint','service-endpoint','ddos-protection','azure-firewall-premium','tls-inspection','idps','dns-private-resolver','vnet-peering-transitive'] },
        { id: 'migration-solutions', name: 'Design de Soluções de Migração', difficulty: 'medium', path: 'az305-infrastructure/migration-solutions', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-migrate','rehost','refactor','rearchitect','lift-and-shift','dms','database-migration','data-box','data-box-heavy','test-migration','cutover','assessment','dependency-analysis','5rs'] },
        { id: 'application-architecture', name: 'Design de Arquitetura de Aplicações', difficulty: 'hard', path: 'az305-infrastructure/application-architecture', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['microservices','monolith','strangler-fig','cqrs','event-sourcing','saga','bff','durable-functions','circuit-breaker','bounded-context','distributed-transactions','outbox'] },
        { id: 'api-management-design', name: 'Design com Azure API Management', difficulty: 'hard', path: 'az305-infrastructure/api-management-design', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['apim','azure-api-management','policies','rate-limiting','jwt-validation','caching','products','developer-portal','self-hosted-gateway','oauth','consumption-tier','backend-for-frontend'] },
        { id: 'devops-solutions', name: 'Design de Soluções DevOps', difficulty: 'medium', path: 'az305-infrastructure/devops-solutions', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['azure-devops','github-actions','azure-pipelines','acr','container-registry','environments','approval-gates','key-vault','variable-groups','helm-deploy','gitops','deployment-environments'] }
      ]
    },
    {
      id: 'az305-security',
      name: 'Security Solutions Design',
      weight: 20, icon: '\u{1F512}', cert: ['az-305'], type: 'cert',
      topics: [
        { id: 'security-design', name: 'Design de Soluções de Segurança', difficulty: 'hard', path: 'az305-security/security-design', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['defense-in-depth','key-vault','managed-identity','system-assigned','user-assigned','waf','ddos-standard','defender-for-cloud','network-segmentation','zero-secrets','purge-protection','service-principal'] },
        { id: 'compliance-design', name: 'Design de Compliance & Regulatório', difficulty: 'hard', path: 'az305-security/compliance-design', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['gdpr','lgpd','pci-dss','iso-27001','regulatory-compliance','purview','data-residency','allowed-locations','cmk','byok','pmk','encryption-at-rest','tls-1-2','data-classification','worm'] }
      ]
    },
    {
      id: 'az305-application',
      name: 'Application Design Solutions',
      weight: 20, icon: '\u{1F4E6}', cert: ['az-305'], type: 'cert',
      topics: [
        { id: 'event-driven-design', name: 'Design Event-Driven Architecture', difficulty: 'hard', path: 'az305-application/event-driven-design', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['event-grid','event-hub','service-bus','event-driven','pub-sub','idempotency','at-least-once','capture','consumer-groups','checkpointing','stream-analytics','event-aggregation','lambda-architecture'] },
        { id: 'microservices-design', name: 'Design de Microserviços', difficulty: 'hard', path: 'az305-application/microservices-design', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['container-apps','aks','aci','dapr','keda','service-discovery','circuit-breaker','health-probes','canary','revision-traffic','strangler-fig','bounded-context','database-per-service'] }
      ]
    }
  ]
};
