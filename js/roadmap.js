// Roadmap — roadmap.sh-style visual learning paths with real forks/branches.
// Pure data + HTML renderer (no canvas). Reads progress from State; links into topics.
// Adding/removing a roadmap never touches the rest of the engine.
var Roadmap = (function () {

  // ─── Roadmap definitions ─────────────────────────────────────────────────────
  // step.type: 'core'      → single node on the central spine (topics[])
  //            'fork'      → branches rendered side-by-side off the spine
  //            'milestone' → certification checkpoint marker
  // branch.kind: 'recommended' | 'alternative' | 'optional'
  var ROADMAPS = [
    {
      id: 'kubernetes',
      icon: '☸️',
      color: '#326ce5',
      label: { pt: 'Kubernetes', en: 'Kubernetes' },
      summary: {
        pt: 'Do container ao cluster seguro em produção. A trilha-mãe — com bifurcações em rede, observabilidade, GitOps e service mesh.',
        en: 'From container to secure production cluster. The flagship path — with forks in networking, observability, GitOps and service mesh.'
      },
      steps: [
        {
          type: 'core',
          label: { pt: 'Fundamentos de Containers', en: 'Container Fundamentals' },
          desc: { pt: 'Imagens, runtime e build antes do orquestrador.', en: 'Images, runtime and build before the orchestrator.' },
          topics: ['docker/container-fundamentals', 'docker/docker-production']
        },
        {
          type: 'core',
          label: { pt: 'Arquitetura do Kubernetes', en: 'Kubernetes Architecture' },
          desc: { pt: 'Control plane, nós, API e os objetos essenciais.', en: 'Control plane, nodes, API and the core objects.' },
          topics: ['kcna-k8s-fundamentals/k8s-architecture', 'cluster-architecture/pods', 'kcna-k8s-fundamentals/k8s-resources']
        },
        {
          type: 'core',
          label: { pt: 'Workloads', en: 'Workloads' },
          desc: { pt: 'Deployments, configuração e agendamento.', en: 'Deployments, configuration and scheduling.' },
          topics: ['workloads/deployments', 'workloads/configmaps-secrets', 'workloads/scheduling']
        },
        {
          type: 'fork',
          label: { pt: 'Exposição de Serviços', en: 'Service Exposure' },
          hint: { pt: 'Ingress é o padrão; Gateway API é o futuro (CKA 2025).', en: 'Ingress is the standard; Gateway API is the future (CKA 2025).' },
          branches: [
            { label: { pt: 'Ingress (clássico)', en: 'Ingress (classic)' }, kind: 'recommended', topics: ['services-networking/services', 'services-networking/ingress'] },
            { label: { pt: 'Gateway API (moderno)', en: 'Gateway API (modern)' }, kind: 'alternative', topics: ['services-networking/gateway-api'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Storage & DNS', en: 'Storage & DNS' },
          desc: { pt: 'Volumes persistentes e resolução de nomes no cluster.', en: 'Persistent volumes and in-cluster name resolution.' },
          topics: ['storage/pv-pvc', 'storage/volumes', 'services-networking/coredns']
        },
        {
          type: 'core',
          label: { pt: 'Identidade & Estado', en: 'Identity & State' },
          desc: { pt: 'RBAC, etcd e ciclo de vida do cluster.', en: 'RBAC, etcd and cluster lifecycle.' },
          topics: ['cluster-architecture/rbac', 'cluster-architecture/etcd', 'cluster-architecture/kubeadm']
        },
        {
          type: 'fork',
          label: { pt: 'Observabilidade', en: 'Observability' },
          hint: { pt: 'Métricas são essenciais; logs e tracing complementam.', en: 'Metrics are essential; logs and tracing complement.' },
          branches: [
            { label: { pt: 'Métricas (Prometheus)', en: 'Metrics (Prometheus)' }, kind: 'recommended', topics: ['prom-fundamentals/prom-architecture', 'prom-fundamentals/promql-basics', 'prom-grafana/grafana-dashboards'] },
            { label: { pt: 'Logs & Tracing', en: 'Logs & Tracing' }, kind: 'optional', topics: ['loki/loki-fundamentals', 'opentelemetry/otel-k8s'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Troubleshooting', en: 'Troubleshooting' },
          desc: { pt: 'Diagnóstico de cluster, runtime (crictl) e velocidade no kubectl.', en: 'Cluster + runtime (crictl) diagnosis and kubectl speed.' },
          topics: ['troubleshooting/cluster-troubleshooting', 'troubleshooting/crictl-runtime', 'cluster-architecture/kubectl-productivity']
        },
        {
          type: 'milestone',
          label: { pt: 'CKA — Administrator', en: 'CKA — Administrator' },
          exam: 'cka'
        },
        {
          type: 'fork',
          label: { pt: 'GitOps', en: 'GitOps' },
          hint: { pt: 'Escolha uma ferramenta de entrega declarativa.', en: 'Pick one declarative delivery tool.' },
          branches: [
            { label: { pt: 'ArgoCD', en: 'ArgoCD' }, kind: 'recommended', topics: ['argocd-fundamentals/argocd-architecture', 'argocd-fundamentals/argocd-applications', 'argocd-patterns/argocd-app-of-apps'] },
            { label: { pt: 'FluxCD', en: 'FluxCD' }, kind: 'alternative', topics: ['fluxcd/fluxcd-fundamentals', 'fluxcd/fluxcd-sources'] }
          ]
        },
        {
          type: 'fork',
          label: { pt: 'Rede Avançada & Service Mesh', en: 'Advanced Networking & Service Mesh' },
          hint: { pt: 'eBPF (Cilium) ou sidecar/Ambient (Istio).', en: 'eBPF (Cilium) or sidecar/Ambient (Istio).' },
          branches: [
            { label: { pt: 'Cilium (eBPF)', en: 'Cilium (eBPF)' }, kind: 'recommended', topics: ['cilium-fundamentals/cilium-architecture', 'cilium-fundamentals/cilium-network-policies', 'cilium-advanced/cilium-service-mesh'] },
            { label: { pt: 'Istio', en: 'Istio' }, kind: 'alternative', topics: ['istio-fundamentals/istio-architecture', 'istio-fundamentals/istio-traffic-mgmt', 'istio-advanced/istio-ambient'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Segurança (Hardening)', en: 'Security (Hardening)' },
          desc: { pt: 'CIS, hardening do API server e runtime security.', en: 'CIS, API server hardening and runtime security.' },
          topics: ['cks-cluster-setup/cis-benchmarks', 'cks-cluster-hardening/api-server-security', 'cks-runtime-security/falco']
        },
        {
          type: 'milestone',
          label: { pt: 'CKS — Security Specialist', en: 'CKS — Security Specialist' },
          exam: 'cks'
        }
      ]
    },
    {
      id: 'devops',
      icon: '🛠️',
      color: '#0078d4',
      label: { pt: 'DevOps Engineer', en: 'DevOps Engineer' },
      summary: {
        pt: 'Entregar software rápido e automatizado: do container ao GitOps, com bifurcações em IaC, GitOps e CI.',
        en: 'Ship software fast and automated: from container to GitOps, with forks in IaC, GitOps and CI.'
      },
      steps: [
        {
          type: 'core',
          label: { pt: 'Containers', en: 'Containers' },
          desc: { pt: 'Build, Compose e boas práticas de produção.', en: 'Build, Compose and production best practices.' },
          topics: ['docker/container-fundamentals', 'docker/docker-compose', 'docker/docker-production']
        },
        {
          type: 'fork',
          label: { pt: 'Infraestrutura como Código', en: 'Infrastructure as Code' },
          hint: { pt: 'Terraform é o padrão; Crossplane traz IaC nativa no K8s.', en: 'Terraform is standard; Crossplane brings K8s-native IaC.' },
          branches: [
            { label: { pt: 'Terraform', en: 'Terraform' }, kind: 'recommended', topics: ['iac/terraform-fundamentals', 'iac/terraform-patterns'] },
            { label: { pt: 'Crossplane', en: 'Crossplane' }, kind: 'optional', topics: ['crossplane/crossplane-fundamentals'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Kubernetes Essencial', en: 'Kubernetes Essentials' },
          desc: { pt: 'Pods, deployments, services e ingress.', en: 'Pods, deployments, services and ingress.' },
          topics: ['cluster-architecture/pods', 'workloads/deployments', 'services-networking/services', 'services-networking/ingress']
        },
        {
          type: 'core',
          label: { pt: 'Empacotamento', en: 'Packaging' },
          desc: { pt: 'Helm: do uso ao desenvolvimento avançado de charts.', en: 'Helm: from usage to advanced chart development.' },
          topics: ['app-deployment/helm', 'helm/helm-chart-development', 'helm/helm-advanced']
        },
        {
          type: 'fork',
          label: { pt: 'GitOps', en: 'GitOps' },
          hint: { pt: 'Escolha sua ferramenta de entrega contínua declarativa.', en: 'Pick your declarative continuous-delivery tool.' },
          branches: [
            { label: { pt: 'ArgoCD', en: 'ArgoCD' }, kind: 'recommended', topics: ['argocd-fundamentals/argocd-architecture', 'argocd-fundamentals/argocd-applications', 'argocd-patterns/argocd-app-of-apps'] },
            { label: { pt: 'FluxCD', en: 'FluxCD' }, kind: 'alternative', topics: ['fluxcd/fluxcd-fundamentals', 'fluxcd/fluxcd-sources', 'fluxcd/fluxcd-advanced'] }
          ]
        },
        {
          type: 'fork',
          label: { pt: 'CI Pipelines', en: 'CI Pipelines' },
          hint: { pt: 'SaaS (GitHub Actions) ou nativo no K8s (Tekton).', en: 'SaaS (GitHub Actions) or K8s-native (Tekton).' },
          branches: [
            { label: { pt: 'GitHub Actions', en: 'GitHub Actions' }, kind: 'recommended', topics: ['cicd/github-actions', 'cicd/pipeline-security'] },
            { label: { pt: 'Tekton', en: 'Tekton' }, kind: 'alternative', topics: ['cicd/tekton'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Policy & Autoscaling', en: 'Policy & Autoscaling' },
          desc: { pt: 'Garantias de governança e escala dirigida a eventos.', en: 'Governance guardrails and event-driven scaling.' },
          topics: ['kyverno/kyverno-policies', 'keda/keda-fundamentals']
        },
        {
          type: 'milestone',
          label: { pt: 'CKAD → CKA', en: 'CKAD → CKA' },
          exam: 'ckad'
        }
      ]
    },
    {
      id: 'sre',
      icon: '📡',
      color: '#107c10',
      label: { pt: 'Site Reliability Engineer', en: 'Site Reliability Engineer' },
      summary: {
        pt: 'Confiabilidade e operação em produção: do mindset SRE ao caos, com bifurcações em visualização/logs e tracing.',
        en: 'Reliability and production operations: from SRE mindset to chaos, with forks in visualization/logs and tracing.'
      },
      steps: [
        {
          type: 'core',
          label: { pt: 'Mindset SRE', en: 'SRE Mindset' },
          desc: { pt: 'SLO/SLI, error budgets e gestão de incidentes.', en: 'SLO/SLI, error budgets and incident management.' },
          topics: ['sre-fundamentals/sre-principles', 'sre-fundamentals/sre-observability', 'sre-fundamentals/sre-incident-mgmt']
        },
        {
          type: 'core',
          label: { pt: 'Kubernetes Operacional', en: 'Operational Kubernetes' },
          desc: { pt: 'etcd, troubleshooting de cluster e de rede.', en: 'etcd, cluster and network troubleshooting.' },
          topics: ['cluster-architecture/etcd', 'troubleshooting/cluster-troubleshooting', 'troubleshooting/network-troubleshooting']
        },
        {
          type: 'core',
          label: { pt: 'Métricas (Prometheus)', en: 'Metrics (Prometheus)' },
          desc: { pt: 'PromQL básico ao avançado e alerting.', en: 'PromQL basics to advanced and alerting.' },
          topics: ['prom-fundamentals/prom-architecture', 'prom-fundamentals/promql-basics', 'prom-fundamentals/promql-advanced', 'prom-fundamentals/prom-alerting']
        },
        {
          type: 'fork',
          label: { pt: 'Visualização & Logs', en: 'Visualization & Logs' },
          hint: { pt: 'Grafana para dashboards; Loki para logs.', en: 'Grafana for dashboards; Loki for logs.' },
          branches: [
            { label: { pt: 'Grafana', en: 'Grafana' }, kind: 'recommended', topics: ['prom-grafana/grafana-dashboards', 'prom-grafana/grafana-alerting'] },
            { label: { pt: 'Loki (logs)', en: 'Loki (logs)' }, kind: 'optional', topics: ['loki/loki-fundamentals', 'loki/logql-alerting'] }
          ]
        },
        {
          type: 'fork',
          label: { pt: 'Tracing Distribuído', en: 'Distributed Tracing' },
          hint: { pt: 'OpenTelemetry é o padrão CNCF para tracing.', en: 'OpenTelemetry is the CNCF standard for tracing.' },
          branches: [
            { label: { pt: 'OpenTelemetry', en: 'OpenTelemetry' }, kind: 'recommended', topics: ['opentelemetry/otel-fundamentals', 'opentelemetry/otel-k8s', 'opentelemetry/otel-collector'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Caos & Capacidade', en: 'Chaos & Capacity' },
          desc: { pt: 'Experimentos de caos e planejamento de capacidade.', en: 'Chaos experiments and capacity planning.' },
          topics: ['chaos-engineering/chaos-fundamentals', 'chaos-engineering/chaos-mesh', 'sre-fundamentals/sre-capacity-planning']
        },
        {
          type: 'core',
          label: { pt: 'Custo (FinOps)', en: 'Cost (FinOps)' },
          desc: { pt: 'Gestão de custo de Kubernetes e práticas FinOps.', en: 'Kubernetes cost management and FinOps practices.' },
          topics: ['finops/finops-practices', 'finops/k8s-cost-management']
        },
        {
          type: 'milestone',
          label: { pt: 'CKA — Administrator', en: 'CKA — Administrator' },
          exam: 'cka'
        }
      ]
    },
    {
      id: 'cloud',
      icon: '☁️',
      color: '#e74c3c',
      label: { pt: 'Cloud Engineer', en: 'Cloud Engineer' },
      summary: {
        pt: 'Infraestrutura e arquitetura de soluções em nuvem. Bifurcação central: AWS ou Azure.',
        en: 'Cloud infrastructure and solution architecture. Central fork: AWS or Azure.'
      },
      steps: [
        {
          type: 'core',
          label: { pt: 'Fundamentos de Cloud', en: 'Cloud Fundamentals' },
          desc: { pt: 'Conceitos, infra global e responsabilidade compartilhada.', en: 'Concepts, global infra and shared responsibility.' },
          topics: ['aws-cloud-concepts/cloud-fundamentals', 'aws-cloud-concepts/aws-global-infra', 'aws-security-compliance/shared-responsibility']
        },
        {
          type: 'fork',
          label: { pt: 'Escolha o Provedor', en: 'Pick the Provider' },
          hint: { pt: 'Aprofunde em um; os conceitos transferem para o outro.', en: 'Go deep in one; concepts transfer to the other.' },
          branches: [
            { label: { pt: 'AWS (Associate)', en: 'AWS (Associate)' }, kind: 'recommended', topics: ['aws-technology-services/compute-services', 'aws-technology-services/storage-databases', 'aws-secure-arch/network-security', 'aws-resilient-arch/ha-fault-tolerance'] },
            { label: { pt: 'Azure (AZ-104)', en: 'Azure (AZ-104)' }, kind: 'alternative', topics: ['az104-identity/entra-id', 'az104-compute/azure-vms', 'az104-networking/vnet-nsg', 'az104-storage/storage-accounts'] }
          ]
        },
        {
          type: 'fork',
          label: { pt: 'Arquitetura Avançada', en: 'Advanced Architecture' },
          hint: { pt: 'Nível profissional/expert do provedor escolhido.', en: 'Professional/expert level of the chosen provider.' },
          branches: [
            { label: { pt: 'AWS SAA → SAP', en: 'AWS SAA → SAP' }, kind: 'recommended', topics: ['aws-new-solutions/serverless-architecture', 'aws-org-complexity/multi-account', 'aws-migration/migration-strategies'] },
            { label: { pt: 'Azure AZ-305', en: 'Azure AZ-305' }, kind: 'alternative', topics: ['az305-infrastructure/compute-solutions', 'az305-data/relational-nosql', 'az305-security/security-design'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'IaC Multi-Cloud', en: 'Multi-Cloud IaC' },
          desc: { pt: 'Terraform como camada comum entre provedores.', en: 'Terraform as the common layer across providers.' },
          topics: ['iac/terraform-fundamentals', 'iac/terraform-patterns', 'iac/terraform-testing']
        },
        {
          type: 'milestone',
          label: { pt: 'AWS SAA / AZ-104', en: 'AWS SAA / AZ-104' },
          exam: 'aws-saa'
        }
      ]
    },
    {
      id: 'platform',
      icon: '🏗️',
      color: '#8764b8',
      label: { pt: 'Platform Engineer', en: 'Platform Engineer' },
      summary: {
        pt: 'Construir a plataforma interna que outros times consomem. Bifurcações em policy, GitOps e service mesh.',
        en: 'Build the internal platform other teams consume. Forks in policy, GitOps and service mesh.'
      },
      steps: [
        {
          type: 'core',
          label: { pt: 'Base do Kubernetes', en: 'Kubernetes Foundation' },
          desc: { pt: 'Pods, RBAC e extensibilidade via CRDs/operators.', en: 'Pods, RBAC and extensibility via CRDs/operators.' },
          topics: ['cluster-architecture/pods', 'cluster-architecture/rbac', 'cluster-architecture/crds-operators']
        },
        {
          type: 'fork',
          label: { pt: 'Policy as Code', en: 'Policy as Code' },
          hint: { pt: 'Governança e admission control no cluster.', en: 'Governance and admission control in the cluster.' },
          branches: [
            { label: { pt: 'Kyverno', en: 'Kyverno' }, kind: 'recommended', topics: ['kyverno/kyverno-fundamentals', 'kyverno/kyverno-policies', 'kyverno/kyverno-advanced'] },
            { label: { pt: 'OPA / Gatekeeper', en: 'OPA / Gatekeeper' }, kind: 'alternative', topics: ['opa/opa-gatekeeper', 'opa/opa-beyond-k8s'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Provisionamento (IaC nativo)', en: 'Provisioning (native IaC)' },
          desc: { pt: 'Crossplane: control plane universal para infraestrutura.', en: 'Crossplane: universal control plane for infrastructure.' },
          topics: ['crossplane/crossplane-fundamentals', 'crossplane/crossplane-providers', 'crossplane/crossplane-compositions']
        },
        {
          type: 'fork',
          label: { pt: 'GitOps', en: 'GitOps' },
          hint: { pt: 'Entrega declarativa do estado da plataforma.', en: 'Declarative delivery of the platform state.' },
          branches: [
            { label: { pt: 'ArgoCD', en: 'ArgoCD' }, kind: 'recommended', topics: ['argocd-fundamentals/argocd-architecture', 'argocd-fundamentals/argocd-applications', 'argocd-patterns/argocd-app-of-apps'] },
            { label: { pt: 'FluxCD', en: 'FluxCD' }, kind: 'alternative', topics: ['fluxcd/fluxcd-fundamentals', 'fluxcd/fluxcd-sources', 'fluxcd/fluxcd-advanced'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Secrets & Certificados', en: 'Secrets & Certificates' },
          desc: { pt: 'Vault, cert-manager e External Secrets.', en: 'Vault, cert-manager and External Secrets.' },
          topics: ['security-tooling/vault-k8s', 'security-tooling/cert-manager', 'security-tooling/external-secrets']
        },
        {
          type: 'fork',
          label: { pt: 'Service Mesh', en: 'Service Mesh' },
          hint: { pt: 'Conectividade, mTLS e observabilidade entre serviços.', en: 'Connectivity, mTLS and inter-service observability.' },
          branches: [
            { label: { pt: 'Cilium (eBPF)', en: 'Cilium (eBPF)' }, kind: 'recommended', topics: ['cilium-fundamentals/cilium-architecture', 'cilium-advanced/cilium-service-mesh'] },
            { label: { pt: 'Istio', en: 'Istio' }, kind: 'alternative', topics: ['istio-fundamentals/istio-architecture', 'istio-advanced/istio-ambient'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Developer Platform (IDP)', en: 'Developer Platform (IDP)' },
          desc: { pt: 'Golden paths, Backstage e métricas (DORA/SPACE).', en: 'Golden paths, Backstage and metrics (DORA/SPACE).' },
          topics: ['platform-engineering/idp-concepts', 'platform-engineering/backstage', 'platform-engineering/golden-paths', 'platform-engineering/platform-metrics']
        },
        {
          type: 'fork',
          label: { pt: 'Escala & Dados', en: 'Scale & Data' },
          hint: { pt: 'Autoscaling dirigido a eventos e dados como serviço.', en: 'Event-driven autoscaling and data-as-a-service.' },
          branches: [
            { label: { pt: 'KEDA (autoscaling)', en: 'KEDA (autoscaling)' }, kind: 'recommended', topics: ['keda/keda-fundamentals', 'keda/keda-advanced'] },
            { label: { pt: 'Databases on K8s', en: 'Databases on K8s' }, kind: 'optional', topics: ['databases-k8s/db-k8s-fundamentals', 'databases-k8s/postgresql-k8s'] }
          ]
        },
        {
          type: 'milestone',
          label: { pt: 'CKA → CKS', en: 'CKA → CKS' },
          exam: 'cka'
        }
      ]
    },
    {
      id: 'security',
      icon: '🛡️',
      color: '#d9534f',
      label: { pt: 'Security Specialist', en: 'Security Specialist' },
      summary: {
        pt: 'Segurança Kubernetes da KCSA ao CKS: hardening, supply chain e runtime, com bifurcações em policy e detecção.',
        en: 'Kubernetes security from KCSA to CKS: hardening, supply chain and runtime, with forks in policy and detection.'
      },
      steps: [
        {
          type: 'core',
          label: { pt: 'Fundamentos (Modelo 4C)', en: 'Fundamentals (4C Model)' },
          desc: { pt: 'Cloud, Cluster, Container, Code — Pod Security e RBAC.', en: 'Cloud, Cluster, Container, Code — Pod Security and RBAC.' },
          topics: ['kcsa-security-overview/4c-security-model', 'kcsa-k8s-security/pod-security-overview', 'kcsa-k8s-security/rbac-overview']
        },
        {
          type: 'core',
          label: { pt: 'Threat Modeling', en: 'Threat Modeling' },
          desc: { pt: 'Vetores de ataque e segurança de rede do cluster.', en: 'Attack vectors and cluster network security.' },
          topics: ['kcsa-threat-model/threat-modeling', 'kcsa-threat-model/attack-vectors', 'kcsa-cluster-security/k8s-networking-security']
        },
        {
          type: 'milestone',
          label: { pt: 'KCSA — Security Associate', en: 'KCSA — Security Associate' },
          exam: 'kcsa'
        },
        {
          type: 'core',
          label: { pt: 'Cluster Hardening', en: 'Cluster Hardening' },
          desc: { pt: 'CIS benchmarks, RBAC avançado e API server.', en: 'CIS benchmarks, advanced RBAC and API server.' },
          topics: ['cks-cluster-setup/cis-benchmarks', 'cks-cluster-hardening/rbac-advanced', 'cks-cluster-hardening/api-server-security']
        },
        {
          type: 'fork',
          label: { pt: 'System Hardening', en: 'System Hardening' },
          hint: { pt: 'Restringir o que o container pode fazer no host.', en: 'Restrict what the container can do on the host.' },
          branches: [
            { label: { pt: 'Seccomp & AppArmor', en: 'Seccomp & AppArmor' }, kind: 'recommended', topics: ['cks-system-hardening/seccomp', 'cks-system-hardening/apparmor', 'cks-system-hardening/os-hardening'] },
            { label: { pt: 'Sandboxing (gVisor)', en: 'Sandboxing (gVisor)' }, kind: 'alternative', topics: ['cks-microservice-vuln/runtime-sandboxing'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Supply Chain', en: 'Supply Chain' },
          desc: { pt: 'Scanning, hardening e assinatura de imagens.', en: 'Image scanning, hardening and signing.' },
          topics: ['cks-supply-chain/image-scanning', 'cks-supply-chain/image-hardening', 'cks-supply-chain/image-signing']
        },
        {
          type: 'fork',
          label: { pt: 'Admission & Policy', en: 'Admission & Policy' },
          hint: { pt: 'Barrar workloads inseguros na entrada do cluster.', en: 'Block insecure workloads at cluster admission.' },
          branches: [
            { label: { pt: 'Kyverno', en: 'Kyverno' }, kind: 'recommended', topics: ['cks-microservice-vuln/pod-security-standards', 'kyverno/kyverno-policies'] },
            { label: { pt: 'OPA / Gatekeeper', en: 'OPA / Gatekeeper' }, kind: 'alternative', topics: ['cks-microservice-vuln/opa-gatekeeper', 'opa/opa-gatekeeper'] }
          ]
        },
        {
          type: 'fork',
          label: { pt: 'Runtime Security', en: 'Runtime Security' },
          hint: { pt: 'Detecção e resposta em tempo de execução.', en: 'Detection and response at runtime.' },
          branches: [
            { label: { pt: 'Falco + Auditoria', en: 'Falco + Audit' }, kind: 'recommended', topics: ['cks-runtime-security/falco', 'cks-runtime-security/audit-logging', 'cks-runtime-security/container-immutability'] },
            { label: { pt: 'Tetragon (eBPF)', en: 'Tetragon (eBPF)' }, kind: 'optional', topics: ['cilium-advanced/cilium-tetragon'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Secrets Management', en: 'Secrets Management' },
          desc: { pt: 'Secrets do K8s, Vault e External Secrets.', en: 'K8s secrets, Vault and External Secrets.' },
          topics: ['cks-microservice-vuln/secrets-management', 'security-tooling/vault-k8s', 'security-tooling/external-secrets']
        },
        {
          type: 'milestone',
          label: { pt: 'CKS — Security Specialist', en: 'CKS — Security Specialist' },
          exam: 'cks'
        }
      ]
    },
    {
      id: 'ai',
      icon: '🤖',
      color: '#9b59b6',
      label: { pt: 'AI for DevOps / SRE', en: 'AI for DevOps / SRE' },
      summary: {
        pt: 'Usar IA generativa e agêntica na engenharia de plataforma e operações.',
        en: 'Use generative and agentic AI in platform engineering and operations.'
      },
      steps: [
        {
          type: 'core',
          label: { pt: 'Fundamentos de LLM', en: 'LLM Fundamentals' },
          desc: { pt: 'Como LLMs funcionam e onde aplicam em DevOps/SRE.', en: 'How LLMs work and where they apply in DevOps/SRE.' },
          topics: ['ai-engineering/llm-fundamentals']
        },
        {
          type: 'fork',
          label: { pt: 'Assistência de Código', en: 'Code Assistance' },
          hint: { pt: 'Agentes de codificação no fluxo de plataforma.', en: 'Coding agents in the platform workflow.' },
          branches: [
            { label: { pt: 'Claude Code (plataforma)', en: 'Claude Code (platform)' }, kind: 'recommended', topics: ['ai-engineering/claude-code-platform'] },
            { label: { pt: 'Copilot para DevOps', en: 'Copilot for DevOps' }, kind: 'alternative', topics: ['ai-engineering/copilot-devops'] }
          ]
        },
        {
          type: 'core',
          label: { pt: 'Contexto & Conhecimento (RAG)', en: 'Context & Knowledge (RAG)' },
          desc: { pt: 'Dar à IA o contexto da sua plataforma com RAG.', en: 'Give the AI your platform context with RAG.' },
          topics: ['ai-engineering/rag-platform']
        },
        {
          type: 'core',
          label: { pt: 'Agentes & Automação', en: 'Agents & Automation' },
          desc: { pt: 'Harness de agentes e casos de spec-driven development.', en: 'Agent harness and spec-driven development cases.' },
          topics: ['ai-engineering/llm-harness', 'ai-engineering/sdd-cases']
        }
      ]
    }
  ];

  // ─── State ────────────────────────────────────────────────────────────────────
  var STORAGE_KEY = 'k8s_active_roadmap';

  function _setActive(id) { try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {} }
  function _getActive() { try { return localStorage.getItem(STORAGE_KEY) || null; } catch (e) { return null; } }

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function _topicExists(path) {
    var reg = window.K8S_REGISTRY;
    if (!reg) return false;
    for (var i = 0; i < reg.domains.length; i++) {
      for (var j = 0; j < reg.domains[i].topics.length; j++) {
        if (reg.domains[i].topics[j].path === path) return true;
      }
    }
    return false;
  }

  function _topicName(path) {
    var reg = window.K8S_REGISTRY;
    if (reg) {
      for (var i = 0; i < reg.domains.length; i++) {
        for (var j = 0; j < reg.domains[i].topics.length; j++) {
          if (reg.domains[i].topics[j].path === path) return reg.domains[i].topics[j].name;
        }
      }
    }
    return path.split('/').pop().replace(/-/g, ' ');
  }

  // Collect every topic path referenced by a roadmap (cores + branches)
  function _allTopics(rm) {
    var list = [];
    rm.steps.forEach(function (s) {
      if (s.type === 'core') list = list.concat(s.topics || []);
      else if (s.type === 'fork') (s.branches || []).forEach(function (b) { list = list.concat(b.topics || []); });
    });
    return list;
  }

  function _progressOf(paths) {
    var real = paths.filter(_topicExists);
    if (!real.length) return { done: 0, total: 0, pct: 0 };
    var done = real.filter(function (p) { return State.getProgress(p) === 'completed'; }).length;
    return { done: done, total: real.length, pct: Math.round(done * 100 / real.length) };
  }

  function _roadmapPct(rm) {
    var p = _progressOf(_allTopics(rm));
    return p.pct;
  }

  // ─── Render: topic node pill ────────────────────────────────────────────────────
  function _renderNode(path, lang) {
    var exists = _topicExists(path);
    var name = _topicName(path);
    if (!exists) {
      return '<span class="rm-node rm-node--missing" title="' + _esc(path) + '">'
        + '<span class="rm-node__dot"></span><span class="rm-node__name">' + _esc(name) + '</span>'
        + '<span class="rm-node__soon">' + I18N.t('comingSoon') + '</span></span>';
    }
    var status = State.getProgress(path); // 'completed' | 'in-progress' | 'not-started'
    var cls = 'rm-node--' + (status || 'not-started');
    return '<button class="rm-node ' + cls + '" data-topic="' + _esc(path) + '">'
      + '<span class="rm-node__dot"></span>'
      + '<span class="rm-node__name">' + _esc(name) + '</span>'
      + '<span class="rm-node__arrow">→</span></button>';
  }

  // ─── Render: picker ─────────────────────────────────────────────────────────────
  function _renderPicker(container) {
    var lang = I18N.getLang();
    var html = '<div class="roadmaps-page">';
    html += '<div class="trails-header"><h1>' + I18N.t('roadmapTitle') + '</h1>';
    html += '<p class="trails-subtitle">' + I18N.t('roadmapSubtitle') + '</p></div>';
    html += '<div class="roadmaps-grid">';

    ROADMAPS.forEach(function (rm) {
      var pct = _roadmapPct(rm);
      var nTopics = _allTopics(rm).filter(_topicExists).length;
      var nForks = rm.steps.filter(function (s) { return s.type === 'fork'; }).length;
      html += '<div class="roadmap-card" data-roadmap="' + rm.id + '" style="--rm-color:' + rm.color + '">';
      html += '<div class="roadmap-card__header"><span class="roadmap-card__icon">' + rm.icon + '</span>';
      html += '<h3 class="roadmap-card__title">' + _esc(rm.label[lang]) + '</h3></div>';
      html += '<p class="roadmap-card__summary">' + _esc(rm.summary[lang]) + '</p>';
      html += '<div class="roadmap-card__progress"><div class="roadmap-card__bar"><div class="roadmap-card__fill" style="width:' + pct + '%"></div></div>';
      html += '<span class="roadmap-card__pct">' + pct + '%</span></div>';
      html += '<div class="roadmap-card__meta"><span>' + nTopics + ' ' + I18N.t('trailTopicsCount') + '</span>';
      html += '<span>' + nForks + ' ' + I18N.t('roadmapForks') + '</span></div>';
      html += '<button class="btn btn-primary roadmap-card__btn" data-roadmap="' + rm.id + '">' + I18N.t('roadmapOpen') + '</button>';
      html += '</div>';
    });

    html += '</div></div>';
    container.innerHTML = html;

    container.querySelectorAll('[data-roadmap]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        window.location.hash = '#roadmap/' + el.getAttribute('data-roadmap');
      });
    });
  }

  // ─── Render: detail (the visual roadmap) ─────────────────────────────────────────
  function _renderDetail(container, rmId) {
    var rm = ROADMAPS.find(function (r) { return r.id === rmId; });
    if (!rm) { container.innerHTML = '<p>Roadmap não encontrado.</p>'; return; }
    _setActive(rmId);
    var lang = I18N.getLang();
    var pct = _roadmapPct(rm);

    var html = '<div class="roadmap-detail" style="--rm-color:' + rm.color + '">';

    // Header
    html += '<div class="roadmap-detail__header">';
    html += '<button class="trail-back-btn" onclick="window.location.hash=\'#trails\'">← ' + I18N.t('roadmapBack') + '</button>';
    html += '<div class="roadmap-detail__title"><span style="font-size:2rem">' + rm.icon + '</span>';
    html += '<div><h1>' + _esc(rm.label[lang]) + '</h1><p>' + _esc(rm.summary[lang]) + '</p></div></div>';
    html += '<div class="roadmap-detail__bar"><div class="roadmap-detail__fill" style="width:' + pct + '%"></div></div>';
    html += '<div class="roadmap-detail__pct">' + pct + '% ' + I18N.t('trailComplete') + '</div>';
    html += '</div>';

    // Body = legend + spine
    html += _spineHTML(rm, lang);
    html += '</div>'; // .roadmap-detail
    container.innerHTML = html;
    _bindBody(container);
  }

  // Legend + spine only (no header). Used standalone and embedded in the Trails toggle.
  function _spineHTML(rm, lang) {
    var html = '';

    // Legend
    html += '<div class="rm-legend">';
    html += '<span class="rm-legend__item"><span class="rm-swatch rm-swatch--completed"></span>' + I18N.t('completed') + '</span>';
    html += '<span class="rm-legend__item"><span class="rm-swatch rm-swatch--in-progress"></span>' + I18N.t('in-progress') + '</span>';
    html += '<span class="rm-legend__item"><span class="rm-swatch rm-swatch--not-started"></span>' + I18N.t('not-started') + '</span>';
    html += '<span class="rm-legend__sep"></span>';
    html += '<span class="rm-legend__item"><span class="rm-kind rm-kind--recommended">' + I18N.t('roadmapRecommended') + '</span></span>';
    html += '<span class="rm-legend__item"><span class="rm-kind rm-kind--alternative">' + I18N.t('roadmapAlternative') + '</span></span>';
    html += '<span class="rm-legend__item"><span class="rm-kind rm-kind--optional">' + I18N.t('roadmapOptional') + '</span></span>';
    html += '</div>';

    // The roadmap spine
    html += '<div class="roadmap">';

    rm.steps.forEach(function (step, idx) {
      var connector = idx > 0 ? '<div class="rm-connector"></div>' : '';

      if (step.type === 'core') {
        var p = _progressOf(step.topics || []);
        html += connector;
        html += '<div class="rm-row rm-row--core">';
        html += '<div class="rm-stage' + (p.total > 0 && p.done === p.total ? ' rm-stage--done' : '') + '">';
        html += '<div class="rm-stage__head"><span class="rm-stage__label">' + _esc(step.label[lang]) + '</span>';
        if (p.total > 0) html += '<span class="rm-stage__count">' + p.done + '/' + p.total + '</span>';
        html += '</div>';
        if (step.desc) html += '<div class="rm-stage__desc">' + _esc(step.desc[lang]) + '</div>';
        html += '<div class="rm-nodes">';
        (step.topics || []).forEach(function (t) { html += _renderNode(t, lang); });
        html += '</div></div></div>';

      } else if (step.type === 'fork') {
        html += connector;
        html += '<div class="rm-row rm-row--fork">';
        html += '<div class="rm-fork__head"><span class="rm-fork__label">⑃ ' + _esc(step.label[lang]) + '</span>';
        if (step.hint) html += '<span class="rm-fork__hint">' + _esc(step.hint[lang]) + '</span>';
        html += '</div>';
        html += '<div class="rm-branches">';
        (step.branches || []).forEach(function (b) {
          var bp = _progressOf(b.topics || []);
          html += '<div class="rm-branch rm-branch--' + b.kind + (bp.total > 0 && bp.done === bp.total ? ' rm-branch--done' : '') + '">';
          html += '<div class="rm-branch__head"><span class="rm-kind rm-kind--' + b.kind + '">' + I18N.t('roadmap' + b.kind.charAt(0).toUpperCase() + b.kind.slice(1)) + '</span>';
          html += '<span class="rm-branch__label">' + _esc(b.label[lang]) + '</span>';
          if (bp.total > 0) html += '<span class="rm-branch__count">' + bp.done + '/' + bp.total + '</span>';
          html += '</div>';
          html += '<div class="rm-nodes">';
          (b.topics || []).forEach(function (t) { html += _renderNode(t, lang); });
          html += '</div></div>';
        });
        html += '</div></div>';

      } else if (step.type === 'milestone') {
        html += connector;
        html += '<div class="rm-row rm-row--milestone">';
        html += '<div class="rm-milestone">';
        html += '<span class="rm-milestone__flag">🏁</span>';
        html += '<span class="rm-milestone__label">' + _esc(step.label[lang]) + '</span>';
        if (step.exam) html += '<button class="btn btn-secondary rm-milestone__btn" data-exam="' + step.exam + '">' + I18N.t('trailExamBtn') + '</button>';
        html += '</div></div>';
      }
    });

    html += '</div>'; // .roadmap
    return html;
  }

  function _bindBody(container) {
    container.querySelectorAll('.rm-node[data-topic]').forEach(function (el) {
      el.addEventListener('click', function () {
        window.location.hash = '#topic/' + el.getAttribute('data-topic');
      });
    });
    container.querySelectorAll('[data-exam]').forEach(function (el) {
      el.addEventListener('click', function () { window.location.hash = '#exam'; });
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  function render(container, rmId) {
    if (rmId) _renderDetail(container, rmId);
    else _renderPicker(container);
  }

  // Render only legend + spine (no header / no progress bar) into a container —
  // used by the Trails screen toggle so the roadmap appears inline as a "view".
  function renderEmbedded(container, rmId) {
    var rm = ROADMAPS.find(function (r) { return r.id === rmId; });
    if (!rm) { container.innerHTML = '<p>Roadmap não encontrado.</p>'; return; }
    var lang = I18N.getLang();
    container.innerHTML = '<div class="roadmap-detail roadmap-detail--embedded" style="--rm-color:' + rm.color + '">' + _spineHTML(rm, lang) + '</div>';
    _bindBody(container);
  }

  function has(rmId) { return ROADMAPS.some(function (r) { return r.id === rmId; }); }
  function get(rmId) { return ROADMAPS.find(function (r) { return r.id === rmId; }) || null; }
  function getActiveId() { return _getActive(); }

  return { render: render, renderEmbedded: renderEmbedded, has: has, get: get, getActiveId: getActiveId, ROADMAPS: ROADMAPS };
})();
