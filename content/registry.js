window.K8S_REGISTRY = {
  certifications: [
    { id: 'cka',  label: 'CKA',  fullName: 'Certified Kubernetes Administrator', passScore: 66, group: 'kubernetes' },
    { id: 'ckad', label: 'CKAD', fullName: 'Certified Kubernetes Application Developer', passScore: 66, group: 'kubernetes' },
    { id: 'kcna', label: 'KCNA', fullName: 'Kubernetes and Cloud Native Associate', passScore: 75, group: 'kubernetes' },
    { id: 'aws-clf', label: 'CLF', fullName: 'AWS Cloud Practitioner (CLF-C02)', passScore: 70, group: 'aws' },
    { id: 'aws-saa', label: 'SAA', fullName: 'AWS Solutions Architect Associate (SAA-C03)', passScore: 72, group: 'aws' },
    { id: 'az-104', label: 'AZ-104', fullName: 'Microsoft Azure Administrator', passScore: 70, group: 'azure' },
  ],

  // ═══════════════════════════════════════════════════════════════════════
  //   Skill Tracks — lateral skills beyond K8s certifications
  // ═══════════════════════════════════════════════════════════════════════
  skillTracks: [
    { id: 'prometheus',       label: 'PROM',    fullName: 'Prometheus & Monitoring Stack',           icon: '🔥' },
    { id: 'sre-practices',    label: 'SRE',     fullName: 'SRE Practices & Reliability',             icon: '📈' },
    { id: 'cilium',           label: 'CILIUM',  fullName: 'Cilium & eBPF Networking',                icon: '🐝' },
    { id: 'istio',            label: 'ISTIO',   fullName: 'Istio Service Mesh',                      icon: '🕸️' },
    { id: 'platform-eng',     label: 'PLAT',    fullName: 'Platform Engineering & IDPs',             icon: '🏗️' },
    { id: 'iac',              label: 'IAC',     fullName: 'Infrastructure as Code (Terraform)',       icon: '⚙️' },
    { id: 'helm-advanced',    label: 'HELM',    fullName: 'Helm Chart Development & Advanced',        icon: '⛵' },
    { id: 'ai-engineering',   label: 'AI',      fullName: 'AI Engineering para DevOps/SRE',          icon: '🤖' },
    { id: 'docker',           label: 'DOCKER',  fullName: 'Docker & Containers',                     icon: '🐳' },
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
        { id: 'rbac', name: 'RBAC', difficulty: 'medium', path: 'cluster-architecture/rbac', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['rbac','role','clusterrole','rolebinding','security'], related: ['app-environment/security'] },
        { id: 'kubeadm', name: 'Kubeadm & Cluster Lifecycle', difficulty: 'hard', path: 'cluster-architecture/kubeadm', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['kubeadm','install','upgrade','cluster'] },
        { id: 'etcd', name: 'ETCD Backup & Restore', difficulty: 'hard', path: 'cluster-architecture/etcd', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['etcd','backup','restore','snapshot'] },
        { id: 'helm-kustomize', name: 'Helm & Kustomize', difficulty: 'medium', path: 'cluster-architecture/helm-kustomize', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['helm','kustomize','package','template'], related: ['app-deployment/helm', 'app-deployment/kustomize'] },
        { id: 'crds-operators', name: 'CRDs, Operators & Extensions', difficulty: 'hard', path: 'cluster-architecture/crds-operators', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['crd','operator','cni','csi','cri']},
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
        { id: 'configmaps-secrets', name: 'ConfigMaps & Secrets', difficulty: 'medium', path: 'workloads/configmaps-secrets', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['configmap','secret','env','volume','config']},
        { id: 'scheduling', name: 'Pod Scheduling', difficulty: 'hard', path: 'workloads/scheduling', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['taint','toleration','affinity','nodeselector','scheduler'] },
        { id: 'autoscaling', name: 'Autoscaling & Self-Healing', difficulty: 'medium', path: 'workloads/autoscaling', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['hpa','replicaset','liveness','readiness','self-healing']}
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
        { id: 'network-policies', name: 'Network Policies', difficulty: 'hard', path: 'services-networking/network-policies', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['networkpolicy','ingress','egress','isolation'], related: ['cilium-fundamentals/cilium-network-policies'] },
        { id: 'ingress', name: 'Ingress & Gateway API', difficulty: 'medium', path: 'services-networking/ingress', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['ingress','ingresscontroller','gateway','routing'], related: ['services-networking/gateway-api', 'istio-fundamentals/istio-gateway'] },
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
        { id: 'monitoring', name: 'Monitoring & Logging', difficulty: 'medium', path: 'troubleshooting/monitoring', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['metrics','top','logs','events','monitoring'], related: ['prom-fundamentals/prom-architecture', 'kcna-observability/observability-fundamentals', 'sre-fundamentals/sre-observability'] }
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
        { id: 'security', name: 'Security Contexts & ServiceAccounts', difficulty: 'hard', path: 'app-environment/security', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['securitycontext','serviceaccount','capabilities','runasuser','rbac']}
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   CKS — Certified Kubernetes Security Specialist
    // ═══════════════════════════════════════════════════════════════════════


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
        { id: 'gitops-cicd', name: 'GitOps & CI/CD Concepts', difficulty: 'easy', path: 'kcna-app-delivery/gitops-cicd', hasQuiz: true, hasFlashcards: true, hasLab: false, tags: ['gitops','cicd','argocd','flux','tekton']}
      ]
    },

    // ═══════════════════════════════════════════════════════════════════════
    //   KCSA — Kubernetes and Cloud Native Security Associate
    // ═══════════════════════════════════════════════════════════════════════


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
        { id: 'cilium-network-policies', name: 'CiliumNetworkPolicy & L7 Security', difficulty: 'medium', path: 'cilium-fundamentals/cilium-network-policies', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['ciliumnetworkpolicy','l7','fqdn','http','kafka','identity-aware']},
        { id: 'cilium-hubble', name: 'Hubble Observability', difficulty: 'medium', path: 'cilium-fundamentals/cilium-hubble', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['hubble','flows','service-map','dns','metrics','observability']}
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
        { id: 'cilium-tetragon', name: 'Tetragon: Runtime Security', difficulty: 'hard', path: 'cilium-advanced/cilium-tetragon', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['tetragon','ebpf','runtime-security','tracingpolicy','enforcement','observability'], related: ['cilium-fundamentals/cilium-architecture', 'cilium-fundamentals/cilium-hubble'] },
        { id: 'cilium-encryption', name: 'Transparent Encryption (WireGuard/IPsec)', difficulty: 'hard', path: 'cilium-advanced/cilium-encryption', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['wireguard','ipsec','encryption','transparent-encryption','compliance','zero-trust'], related: ['cilium-fundamentals/cilium-architecture', 'services-networking/network-policies'] },
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
        { id: 'terraform-k8s', name: 'Terraform & Kubernetes', difficulty: 'hard', path: 'iac/terraform-k8s', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['terraform','kubernetes','eks','gke','aks','helm-provider','kubernetes-provider'], related: ['platform-engineering/idp-concepts'] },
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
        { id: 'helm-chart-development', name: 'Helm Chart Development', difficulty: 'medium', path: 'helm/helm-chart-development', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['helm','chart','templates','values','helpers','hooks','tests','toYaml','nindent','go-template','sprig','packaging'], related: ['app-deployment/helm'] },
        { id: 'helm-advanced', name: 'Helm Avançado: OCI, Library Charts & CI/CD', difficulty: 'hard', path: 'helm/helm-advanced', hasQuiz: true, hasFlashcards: true, hasLab: true, tags: ['helm','oci-registry','library-chart','subcharts','dependencies','values-schema','helm-test','ci-cd','github-actions','harbor','ecr'] }
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

  ]
};
