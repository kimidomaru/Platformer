// Trails — Role-based learning roadmaps
var Trails = (function () {

  // ─── Trail definitions ──────────────────────────────────────────────────────
  var TRAILS = [
    {
      id: 'devops',
      roadmap: 'devops',
      icon: '🛠️',
      color: '#0078d4',
      label: { pt: 'DevOps Engineer', en: 'DevOps Engineer' },
      summary: {
        pt: 'Entregar software rápido, confiável e automatizado. Do container ao GitOps.',
        en: 'Ship software fast, reliably, and automatically. From containers to GitOps.'
      },
      levels: [
        {
          label: { pt: 'Nível 1 — Containers & IaC', en: 'Level 1 — Containers & IaC' },
          topics: [
            'docker/container-fundamentals',
            'docker/docker-compose',
            'docker/docker-production',
            'iac/terraform-fundamentals',
            'cicd/github-actions',
            'cicd/pipeline-security'
          ]
        },
        {
          label: { pt: 'Nível 2 — Kubernetes Core', en: 'Level 2 — Kubernetes Core' },
          topics: [
            'cluster-architecture/pods',
            'workloads/deployments',
            'workloads/configmaps-secrets',
            'services-networking/services',
            'services-networking/ingress',
            'app-deployment/deployment-strategies'
          ]
        },
        {
          label: { pt: 'Nível 3 — Empacotamento, GitOps & CI', en: 'Level 3 — Packaging, GitOps & CI' },
          topics: [
            'app-deployment/helm',
            'helm/helm-chart-development',
            'helm/helm-advanced',
            'argocd-fundamentals/argocd-architecture',
            'argocd-fundamentals/argocd-applications',
            'argocd-fundamentals/argocd-sync-strategies',
            'argocd-fundamentals/argocd-projects',
            'fluxcd/fluxcd-fundamentals',
            'fluxcd/fluxcd-sources',
            'cicd/tekton'
          ]
        },
        {
          label: { pt: 'Nível 4 — GitOps Avançado & Confiabilidade', en: 'Level 4 — Advanced GitOps & Reliability' },
          topics: [
            'argocd-patterns/argocd-app-of-apps',
            'argocd-patterns/argocd-advanced',
            'fluxcd/fluxcd-advanced',
            'kyverno/kyverno-policies',
            'keda/keda-fundamentals',
            'observability/probes',
            'iac/terraform-patterns',
            'iac/terraform-testing'
          ]
        },
        {
          label: { pt: 'Certificações', en: 'Certifications' },
          certs: true,
          topics: ['CKAD → CKA'],
          exam: ['ckad', 'cka']
        }
      ]
    },
    {
      id: 'sre',
      roadmap: 'sre',
      icon: '📡',
      color: '#107c10',
      label: { pt: 'Site Reliability Engineer', en: 'Site Reliability Engineer' },
      summary: {
        pt: 'Confiabilidade, observabilidade e operação de sistemas em produção.',
        en: 'Reliability, observability and operation of production systems.'
      },
      levels: [
        {
          label: { pt: 'Nível 1 — Mindset SRE', en: 'Level 1 — SRE Mindset' },
          topics: [
            'sre-fundamentals/sre-principles',
            'sre-fundamentals/sre-observability',
            'sre-fundamentals/sre-incident-mgmt',
            'sre-operations/sre-oncall',
            'sre-operations/sre-toil-automation',
            'observability/probes'
          ]
        },
        {
          label: { pt: 'Nível 2 — Kubernetes Operacional', en: 'Level 2 — Operational Kubernetes' },
          topics: [
            'cluster-architecture/pods',
            'cluster-architecture/etcd',
            'troubleshooting/app-failure',
            'troubleshooting/cluster-troubleshooting',
            'troubleshooting/network-troubleshooting',
            'storage/pv-pvc'
          ]
        },
        {
          label: { pt: 'Nível 3 — Stack de Observabilidade', en: 'Level 3 — Observability Stack' },
          topics: [
            'prom-fundamentals/prom-architecture',
            'prom-fundamentals/promql-basics',
            'prom-fundamentals/promql-advanced',
            'prom-fundamentals/prom-alerting',
            'prom-fundamentals/prom-service-discovery',
            'prom-fundamentals/prom-exporters',
            'prom-grafana/grafana-dashboards',
            'prom-grafana/grafana-alerting',
            'loki/loki-fundamentals',
            'loki/logql-alerting',
            'opentelemetry/otel-fundamentals',
            'opentelemetry/otel-k8s',
            'opentelemetry/otel-collector'
          ]
        },
        {
          label: { pt: 'Nível 4 — Caos, Capacidade & Custo', en: 'Level 4 — Chaos, Capacity & Cost' },
          topics: [
            'chaos-engineering/chaos-fundamentals',
            'chaos-engineering/chaos-mesh',
            'chaos-engineering/litmus-chaos',
            'sre-fundamentals/sre-capacity-planning',
            'sre-operations/sre-deployment-safety',
            'sre-operations/sre-capacity',
            'keda/keda-fundamentals',
            'keda/keda-advanced',
            'finops/finops-practices',
            'finops/k8s-cost-management'
          ]
        },
        {
          label: { pt: 'Certificações', en: 'Certifications' },
          certs: true,
          topics: ['CKA'],
          exam: ['cka']
        }
      ]
    },
    {
      id: 'platform',
      roadmap: 'platform',
      icon: '🏗️',
      color: '#8764b8',
      label: { pt: 'Platform Engineer', en: 'Platform Engineer' },
      summary: {
        pt: 'Construir a plataforma interna que outros times usam para desenvolver e operar software.',
        en: 'Build the internal platform that other teams use to develop and operate software.'
      },
      levels: [
        {
          label: { pt: 'Nível 1 — Kubernetes Profundo', en: 'Level 1 — Deep Kubernetes' },
          topics: [
            'cluster-architecture/pods',
            'cluster-architecture/rbac',
            'cluster-architecture/crds-operators',
            'workloads/deployments',
            'services-networking/ingress',
            'storage/pv-pvc'
          ]
        },
        {
          label: { pt: 'Nível 2 — Extensibilidade & Policy', en: 'Level 2 — Extensibility & Policy' },
          topics: [
            'kyverno/kyverno-fundamentals',
            'kyverno/kyverno-policies',
            'kyverno/kyverno-advanced',
            'opa/opa-gatekeeper',
            'opa/opa-beyond-k8s',
            'keda/keda-fundamentals',
            'crossplane/crossplane-fundamentals',
            'crossplane/crossplane-providers',
            'crossplane/crossplane-compositions',
            'security-tooling/cert-manager',
            'security-tooling/external-secrets'
          ]
        },
        {
          label: { pt: 'Nível 3 — Service Mesh & Networking', en: 'Level 3 — Service Mesh & Networking' },
          topics: [
            'cilium-fundamentals/cilium-architecture',
            'cilium-fundamentals/cilium-network-policies',
            'cilium-fundamentals/cilium-hubble',
            'cilium-advanced/cilium-service-mesh',
            'cilium-advanced/cilium-bgp-lb',
            'cilium-advanced/cilium-cluster-mesh',
            'istio-fundamentals/istio-architecture',
            'istio-fundamentals/istio-traffic-mgmt',
            'istio-fundamentals/istio-gateway',
            'istio-advanced/istio-security',
            'istio-advanced/istio-observability',
            'kong/kong-fundamentals',
            'kong/kong-plugins'
          ]
        },
        {
          label: { pt: 'Nível 4 — Developer Platform (IDP)', en: 'Level 4 — Developer Platform (IDP)' },
          topics: [
            'platform-engineering/idp-concepts',
            'platform-engineering/backstage',
            'platform-engineering/golden-paths',
            'platform-engineering/platform-metrics',
            'helm/helm-chart-development',
            'iac/terraform-k8s',
            'fluxcd/fluxcd-sources',
            'fluxcd/fluxcd-advanced',
            'databases-k8s/db-k8s-fundamentals',
            'databases-k8s/postgresql-k8s',
            'databases-k8s/redis-k8s',
            'finops/k8s-cost-management'
          ]
        },
        {
          label: { pt: 'Nível 5 — Especialização Avançada', en: 'Level 5 — Advanced Specialization' },
          topics: [
            'cilium-advanced/cilium-tetragon',
            'cilium-advanced/cilium-encryption',
            'cilium-advanced/cilium-egress-gateway',
            'istio-advanced/istio-advanced-patterns',
            'istio-advanced/istio-ambient',
            'kong/kong-advanced',
            'argocd-patterns/argocd-app-of-apps',
            'argocd-patterns/argocd-advanced',
            'security-tooling/vault-k8s'
          ]
        },
        {
          label: { pt: 'Certificações', en: 'Certifications' },
          certs: true,
          topics: ['CKA → CKS'],
          exam: ['cka', 'cks']
        }
      ]
    },
    {
      id: 'cloud',
      roadmap: 'cloud',
      icon: '☁️',
      color: '#e74c3c',
      label: { pt: 'Cloud Engineer', en: 'Cloud Engineer' },
      summary: {
        pt: 'Infraestrutura cloud, multi-cloud e arquitetura de soluções em Azure e AWS.',
        en: 'Cloud infrastructure, multi-cloud and solution architecture on Azure and AWS.'
      },
      levels: [
        {
          label: { pt: 'Nível 1 — Cloud Fundamentals', en: 'Level 1 — Cloud Fundamentals' },
          topics: [
            'aws-cloud-concepts/cloud-fundamentals',
            'aws-cloud-concepts/aws-global-infra',
            'aws-security-compliance/iam-basics',
            'aws-security-compliance/shared-responsibility',
            'az104-identity/entra-id',
            'az104-networking/vnet-nsg'
          ]
        },
        {
          label: { pt: 'Nível 2 — Arquitetura AWS (SAA)', en: 'Level 2 — AWS Architecture (SAA)' },
          topics: [
            'aws-technology-services/compute-services',
            'aws-technology-services/storage-databases',
            'aws-secure-arch/network-security',
            'aws-resilient-arch/ha-fault-tolerance',
            'aws-new-solutions/serverless-architecture',
            'aws-migration/migration-strategies'
          ]
        },
        {
          label: { pt: 'Nível 3 — Administração Azure (AZ-104)', en: 'Level 3 — Azure Administration (AZ-104)' },
          topics: [
            'az104-identity/azure-rbac',
            'az104-compute/azure-vms',
            'az104-storage/storage-accounts',
            'az104-networking/azure-lb-appgw',
            'az104-networking/vpn-expressroute',
            'az104-monitor/azure-monitor'
          ]
        },
        {
          label: { pt: 'Nível 4 — Arquitetura de Soluções (AZ-305)', en: 'Level 4 — Solutions Architecture (AZ-305)' },
          topics: [
            'az305-infrastructure/compute-solutions',
            'az305-infrastructure/network-topology',
            'az305-data/relational-nosql',
            'az305-security/security-design',
            'az305-continuity/bcdr-design',
            'az305-application/microservices-design',
            'iac/terraform-fundamentals',
            'iac/terraform-patterns',
            'iac/terraform-testing'
          ]
        },
        {
          label: { pt: 'Certificações', en: 'Certifications' },
          certs: true,
          topics: ['AZ-104 → AZ-305 → AWS SAA'],
          exam: ['az-104', 'az-305', 'aws-saa']
        }
      ]
    },
    {
      id: 'k8s-specialist',
      roadmap: 'kubernetes',
      icon: '⚙️',
      color: '#326ce5',
      label: { pt: 'Kubernetes Specialist', en: 'Kubernetes Specialist' },
      summary: {
        pt: 'Domínio completo do ecossistema Kubernetes — da KCNA ao CKS. A trilha mais longa e mais completa.',
        en: 'Complete mastery of the Kubernetes ecosystem — from KCNA to CKS. The longest and most complete track.'
      },
      levels: [
        {
          label: { pt: 'Pré-requisitos', en: 'Prerequisites' },
          topics: [
            'docker/container-fundamentals',
            'docker/docker-compose',
            'docker/docker-production'
          ]
        },
        {
          label: { pt: 'Nível 1 — KCNA', en: 'Level 1 — KCNA' },
          checkpoint: 'kcna',
          topics: [
            'kcna-k8s-fundamentals/k8s-architecture',
            'kcna-k8s-fundamentals/k8s-resources',
            'kcna-k8s-fundamentals/containers-runtime',
            'kcna-orchestration/orchestration-fundamentals',
            'kcna-cloud-native/cloud-native-fundamentals',
            'kcna-cloud-native/cncf-ecosystem',
            'kcna-observability/observability-fundamentals',
            'kcna-app-delivery/gitops-cicd'
          ]
        },
        {
          label: { pt: 'Nível 2 — CKA', en: 'Level 2 — CKA' },
          checkpoint: 'cka',
          topics: [
            'cluster-architecture/pods',
            'cluster-architecture/rbac',
            'cluster-architecture/etcd',
            'cluster-architecture/kubeadm',
            'workloads/deployments',
            'workloads/scheduling',
            'services-networking/services',
            'services-networking/network-policies',
            'services-networking/ingress',
            'storage/pv-pvc',
            'troubleshooting/app-failure',
            'troubleshooting/cluster-troubleshooting'
          ]
        },
        {
          label: { pt: 'Nível 3 — CKAD', en: 'Level 3 — CKAD' },
          checkpoint: 'ckad',
          topics: [
            'app-design-build/container-images',
            'app-design-build/multi-container',
            'app-design-build/workload-resources',
            'app-deployment/deployment-strategies',
            'app-deployment/helm',
            'observability/probes',
            'app-environment/requests-limits',
            'workloads/configmaps-secrets'
          ]
        },
        {
          label: { pt: 'Nível 4 — KCSA', en: 'Level 4 — KCSA' },
          checkpoint: 'kcsa',
          topics: [
            'kcsa-security-overview/4c-security-model',
            'kcsa-k8s-security/pod-security-overview',
            'kcsa-k8s-security/rbac-overview',
            'kcsa-cluster-security/k8s-networking-security',
            'kcsa-threat-model/threat-modeling',
            'kcsa-platform-security/supply-chain-overview',
            'kcsa-compliance/compliance-frameworks'
          ]
        },
        {
          label: { pt: 'Nível 5 — CKS', en: 'Level 5 — CKS' },
          checkpoint: 'cks',
          topics: [
            'cks-cluster-setup/cis-benchmarks',
            'cks-cluster-hardening/rbac-advanced',
            'cks-cluster-hardening/api-server-security',
            'cks-system-hardening/seccomp',
            'cks-system-hardening/apparmor',
            'cks-microservice-vuln/pod-security-standards',
            'cks-microservice-vuln/secrets-management',
            'cks-supply-chain/image-scanning',
            'cks-supply-chain/image-signing',
            'cks-runtime-security/falco',
            'cks-runtime-security/audit-logging'
          ]
        },
        {
          label: { pt: 'Nível 6 — Especialização', en: 'Level 6 — Specialization' },
          topics: [
            'cilium-fundamentals/cilium-architecture',
            'cilium-fundamentals/cilium-hubble',
            'cilium-advanced/cilium-service-mesh',
            'cilium-advanced/cilium-bgp-lb',
            'cilium-advanced/cilium-cluster-mesh',
            'cilium-advanced/cilium-tetragon',
            'cilium-advanced/cilium-encryption',
            'cilium-advanced/cilium-egress-gateway',
            'istio-fundamentals/istio-architecture',
            'istio-advanced/istio-security',
            'istio-advanced/istio-ambient',
            'security-tooling/vault-k8s',
            'argocd-patterns/argocd-app-of-apps',
            'ai-engineering/llm-fundamentals'
          ]
        }
      ]
    },
    {
      id: 'ai-devops',
      roadmap: 'ai',
      icon: '🤖',
      color: '#9b59b6',
      label: { pt: 'AI for DevOps / SRE', en: 'AI for DevOps / SRE' },
      summary: {
        pt: 'Usar IA generativa e agêntica para acelerar engenharia de plataforma, operações e automação.',
        en: 'Use generative and agentic AI to accelerate platform engineering, operations and automation.'
      },
      levels: [
        {
          label: { pt: 'Nível 1 — Fundamentos de LLMs', en: 'Level 1 — LLM Fundamentals' },
          topics: [
            'ai-engineering/llm-fundamentals',
            'ai-engineering/copilot-devops'
          ]
        },
        {
          label: { pt: 'Nível 2 — Ferramentas & Assistência', en: 'Level 2 — Tools & Assistance' },
          topics: [
            'ai-engineering/claude-code-platform',
            'ai-engineering/rag-platform'
          ]
        },
        {
          label: { pt: 'Nível 3 — Agentes & Automação', en: 'Level 3 — Agents & Automation' },
          topics: [
            'ai-engineering/llm-harness',
            'ai-engineering/sdd-cases'
          ]
        }
      ]
    }
  ];

  // ─── State ──────────────────────────────────────────────────────────────────
  var _activeTrailId = null;
  var STORAGE_KEY = 'k8s_active_trail';

  function _getActiveTrail() {
    try { return localStorage.getItem(STORAGE_KEY) || null; } catch (e) { return null; }
  }

  function _setActiveTrail(id) {
    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
    _activeTrailId = id;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function _topicExists(path) {
    var registry = window.K8S_REGISTRY;
    if (!registry) return false;
    for (var i = 0; i < registry.domains.length; i++) {
      for (var j = 0; j < registry.domains[i].topics.length; j++) {
        if (registry.domains[i].topics[j].path === path) return true;
      }
    }
    return false;
  }

  function _topicName(path) {
    var registry = window.K8S_REGISTRY;
    if (!registry) return path;
    for (var i = 0; i < registry.domains.length; i++) {
      for (var j = 0; j < registry.domains[i].topics.length; j++) {
        if (registry.domains[i].topics[j].path === path) {
          return registry.domains[i].topics[j].name;
        }
      }
    }
    return path.split('/').pop().replace(/-/g, ' ');
  }

  function _levelProgress(level) {
    var realTopics = level.topics.filter(function (t) { return !t.includes(' → ') && _topicExists(t); });
    if (realTopics.length === 0) return { done: 0, total: 0, pct: 0 };
    var done = realTopics.filter(function (t) {
      return State.getProgress(t) === 'completed';
    }).length;
    return { done: done, total: realTopics.length, pct: Math.round(done * 100 / realTopics.length) };
  }

  function _trailProgress(trail) {
    var totalDone = 0, totalTopics = 0;
    trail.levels.forEach(function (level) {
      var p = _levelProgress(level);
      totalDone += p.done;
      totalTopics += p.total;
    });
    return totalTopics === 0 ? 0 : Math.round(totalDone * 100 / totalTopics);
  }

  // ─── Render: trail picker ────────────────────────────────────────────────────
  function _renderPicker(container) {
    var lang = I18N.getLang();
    var html = '<div class="trails-page">';
    html += '<div class="trails-header">';
    html += '<h1>' + I18N.t('trailsTitle') + '</h1>';
    html += '<p class="trails-subtitle">' + I18N.t('trailsSubtitle') + '</p>';
    html += '</div>';
    html += '<div class="trails-grid">';

    TRAILS.forEach(function (trail) {
      var pct = _trailProgress(trail);
      var isActive = _activeTrailId === trail.id;
      html += '<div class="trail-card' + (isActive ? ' trail-card--active' : '') + '" data-trail="' + trail.id + '" style="--trail-color:' + trail.color + '">';
      html += '<div class="trail-card__header">';
      html += '<span class="trail-card__icon">' + trail.icon + '</span>';
      html += '<div>';
      html += '<h3 class="trail-card__title">' + trail.label[lang] + '</h3>';
      if (isActive) {
        html += '<span class="trail-card__badge">' + I18N.t('trailActive') + '</span>';
      }
      html += '</div>';
      html += '</div>';
      html += '<p class="trail-card__summary">' + trail.summary[lang] + '</p>';

      // Progress bar
      html += '<div class="trail-card__progress">';
      html += '<div class="trail-card__progress-bar"><div class="trail-card__progress-fill" style="width:' + pct + '%"></div></div>';
      html += '<span class="trail-card__progress-pct">' + pct + '%</span>';
      html += '</div>';

      // Level count
      var totalTopics = 0;
      trail.levels.forEach(function (l) {
        totalTopics += l.topics.filter(function (t) { return !t.includes(' → ') && _topicExists(t); }).length;
      });
      html += '<div class="trail-card__meta">';
      html += '<span>' + trail.levels.length + ' ' + I18N.t('trailLevels') + '</span>';
      html += '<span>' + totalTopics + ' ' + I18N.t('trailTopicsCount') + '</span>';
      html += '</div>';

      html += '<button class="btn-primary trail-card__btn" data-trail="' + trail.id + '">';
      html += isActive ? I18N.t('trailContinue') : I18N.t('trailStart');
      html += '</button>';
      html += '</div>';
    });

    // Roadmap-only paths (no matching trail) — e.g. Security. Open straight in roadmap view.
    if (typeof Roadmap !== 'undefined') {
      var linked = {};
      TRAILS.forEach(function (t) { if (t.roadmap) linked[t.roadmap] = 1; });
      Roadmap.ROADMAPS.forEach(function (rm) {
        if (linked[rm.id]) return;
        var nodes = 0, forks = 0;
        rm.steps.forEach(function (s) {
          if (s.type === 'core') nodes += (s.topics || []).filter(_topicExists).length;
          else if (s.type === 'fork') { forks++; (s.branches || []).forEach(function (b) { nodes += (b.topics || []).filter(_topicExists).length; }); }
        });
        html += '<div class="trail-card" data-roadmap="' + rm.id + '" style="--trail-color:' + rm.color + '">';
        html += '<div class="trail-card__header"><span class="trail-card__icon">' + rm.icon + '</span>';
        html += '<div><h3 class="trail-card__title">' + rm.label[lang] + '</h3>';
        html += '<span class="trail-card__badge trail-card__badge--rm">' + I18N.t('roadmapOnlyBadge') + '</span></div></div>';
        html += '<p class="trail-card__summary">' + rm.summary[lang] + '</p>';
        html += '<div class="trail-card__meta"><span>' + nodes + ' ' + I18N.t('trailTopicsCount') + '</span>';
        html += '<span>' + forks + ' ' + I18N.t('roadmapForks') + '</span></div>';
        html += '<button class="btn-primary trail-card__btn" data-roadmap="' + rm.id + '">' + I18N.t('roadmapOpen') + '</button>';
        html += '</div>';
      });
    }

    html += '</div></div>';
    container.innerHTML = html;

    // Bind clicks (cards may be trail-backed [data-trail] or roadmap-only [data-roadmap])
    function _goCard(el) {
      var tid = el.getAttribute('data-trail');
      var rid = el.getAttribute('data-roadmap');
      if (tid) { _setActiveTrail(tid); window.location.hash = '#trails/' + tid; }
      else if (rid) { window.location.hash = '#roadmap/' + rid; }
    }
    container.querySelectorAll('.trail-card__btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.stopPropagation(); _goCard(btn); });
    });
    container.querySelectorAll('.trail-card').forEach(function (card) {
      card.addEventListener('click', function () { _goCard(card); });
    });
  }

  // ─── Render: trail detail ────────────────────────────────────────────────────
  function _renderDetail(container, trailId) {
    var trail = TRAILS.find(function (t) { return t.id === trailId; });
    if (!trail) { container.innerHTML = '<p>Trilha não encontrada.</p>'; return; }

    _setActiveTrail(trailId);
    var lang = I18N.getLang();
    var pct = _trailProgress(trail);

    var html = '<div class="trail-detail">';

    // Header
    html += '<div class="trail-detail__header" style="--trail-color:' + trail.color + '">';
    html += '<button class="trail-back-btn" onclick="window.location.hash=\'#trails\'">';
    html += '← ' + I18N.t('trailBack');
    html += '</button>';
    html += '<div class="trail-detail__title">';
    html += '<span style="font-size:2rem">' + trail.icon + '</span>';
    html += '<div>';
    html += '<h1>' + trail.label[lang] + '</h1>';
    html += '<p>' + trail.summary[lang] + '</p>';
    html += '</div>';
    html += '</div>';
    html += '<div class="trail-detail__progress-bar">';
    html += '<div class="trail-detail__progress-fill" style="width:' + pct + '%"></div>';
    html += '</div>';
    html += '<div class="trail-detail__progress-label">' + pct + '% ' + I18N.t('trailComplete') + '</div>';
    html += '</div>';

    // View toggle (only when a roadmap is linked to this trail)
    var hasRoadmap = trail.roadmap && typeof Roadmap !== 'undefined' && Roadmap.has(trail.roadmap);
    var view = hasRoadmap ? _getView() : 'list';
    if (hasRoadmap) {
      html += '<div class="path-toggle">';
      html += '<button class="path-toggle__btn' + (view === 'list' ? ' active' : '') + '" data-view="list">📋 ' + I18N.t('trailViewList') + '</button>';
      html += '<button class="path-toggle__btn' + (view === 'roadmap' ? ' active' : '') + '" data-view="roadmap">🛠️ ' + I18N.t('trailViewRoadmap') + '</button>';
      html += '</div>';
    }

    // View body — filled by showList()/showRoadmap()
    html += '<div class="trail-view-body" id="trail-view-body"></div>';
    html += '</div>'; // trail-detail

    container.innerHTML = html;

    var body = container.querySelector('#trail-view-body');
    function showList() { body.innerHTML = _levelsHTML(trail, lang); _bindLevels(body); }
    function showRoadmap() { Roadmap.renderEmbedded(body, trail.roadmap); }

    if (view === 'roadmap' && hasRoadmap) showRoadmap(); else showList();

    // Bind the view toggle
    container.querySelectorAll('.path-toggle__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-view');
        _setView(v);
        container.querySelectorAll('.path-toggle__btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
        if (v === 'roadmap') showRoadmap(); else showList();
      });
    });
  }

  // Build the vertical levels (list view) HTML for a trail.
  function _levelsHTML(trail, lang) {
    var html = '<div class="trail-levels">';
    trail.levels.forEach(function (level, levelIdx) {
      var lp = _levelProgress(level);
      var levelDone = lp.total > 0 && lp.done === lp.total;
      var hasCheckpoint = !!level.checkpoint;

      html += '<div class="trail-level' + (levelDone ? ' trail-level--done' : '') + '">';
      html += '<div class="trail-level__header">';
      html += '<div class="trail-level__number">' + (levelIdx + 1) + '</div>';
      html += '<div class="trail-level__info">';
      html += '<h3>' + level.label[lang] + '</h3>';
      if (lp.total > 0) {
        html += '<span class="trail-level__sub">' + lp.done + '/' + lp.total + ' ' + I18N.t('trailTopicsDone') + '</span>';
      }
      html += '</div>';
      if (levelDone) { html += '<span class="trail-level__check">✓</span>'; }
      html += '</div>';

      if (!level.certs) {
        html += '<div class="trail-level__topics">';
        level.topics.forEach(function (topicPath) {
          if (topicPath.includes(' → ')) {
            html += '<div class="trail-topic trail-topic--cert-label">' + topicPath + '</div>';
            return;
          }
          var exists = _topicExists(topicPath);
          var status = exists ? State.getProgress(topicPath) : 'not-started';
          var name = exists ? _topicName(topicPath) : topicPath.split('/').pop().replace(/-/g, ' ');
          var statusIcon = status === 'completed' ? '✓' : (status === 'in-progress' ? '◑' : '○');
          var statusClass = 'trail-topic--' + status;

          html += '<div class="trail-topic ' + statusClass + (exists ? ' trail-topic--clickable' : ' trail-topic--missing') + '"' + (exists ? ' data-topic="' + topicPath + '"' : '') + '>';
          html += '<span class="trail-topic__icon">' + statusIcon + '</span>';
          html += '<span class="trail-topic__name">' + name + '</span>';
          if (!exists) { html += '<span class="trail-topic__coming">' + I18N.t('comingSoon') + '</span>'; }
          else { html += '<span class="trail-topic__arrow">→</span>'; }
          html += '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="trail-level__certs">';
        html += '<p>' + I18N.t('trailCertLabel') + ' <strong>' + level.topics.join(', ') + '</strong></p>';
        html += '<button class="btn-secondary trail-exam-btn" data-cert="' + (level.exam ? level.exam[0] : '') + '">' + I18N.t('trailExamBtn') + '</button>';
        html += '</div>';
      }

      if (hasCheckpoint) {
        html += '<div class="trail-checkpoint">';
        html += '<span class="trail-checkpoint__flag">🏁</span> ';
        html += '<span>' + I18N.t('trailCheckpoint') + ': ' + level.checkpoint.toUpperCase() + '</span>';
        if (levelDone) { html += ' <span class="trail-checkpoint__done">✓ ' + I18N.t('trailCheckpointDone') + '</span>'; }
        html += '</div>';
      }

      html += '</div>'; // trail-level
    });
    html += '</div>'; // trail-levels
    return html;
  }

  function _bindLevels(container) {
    container.querySelectorAll('.trail-topic--clickable').forEach(function (el) {
      el.addEventListener('click', function () {
        var path = el.getAttribute('data-topic');
        if (path) window.location.hash = '#topic/' + path;
      });
    });
    container.querySelectorAll('.trail-exam-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { window.location.hash = '#exam'; });
    });
  }

  // Remember the preferred view (list | roadmap) across paths.
  var VIEW_KEY = 'k8s_path_view';
  function _getView() { try { return localStorage.getItem(VIEW_KEY) === 'roadmap' ? 'roadmap' : 'list'; } catch (e) { return 'list'; } }
  function _setView(v) { try { localStorage.setItem(VIEW_KEY, v); } catch (e) {} }

  // ─── Public API ──────────────────────────────────────────────────────────────
  function render(container, trailId) {
    _activeTrailId = _getActiveTrail();
    if (trailId) {
      _renderDetail(container, trailId);
    } else {
      _renderPicker(container);
    }
  }

  function getActiveTrailId() {
    return _activeTrailId || _getActiveTrail();
  }

  return { render: render, getActiveTrailId: getActiveTrailId, TRAILS: TRAILS };
})();
