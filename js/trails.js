// Trails — Role-based learning roadmaps
var Trails = (function () {

  // ─── Trail definitions ──────────────────────────────────────────────────────
  var TRAILS = [
    {
      id: 'devops',
      icon: '🛠️',
      color: '#0078d4',
      label: { pt: 'DevOps Engineer', en: 'DevOps Engineer' },
      summary: {
        pt: 'Entregar software rápido, confiável e automatizado. Do container ao GitOps.',
        en: 'Ship software fast, reliably, and automatically. From containers to GitOps.'
      },
      levels: [
        {
          label: { pt: 'Nível 1 — Fundamentos', en: 'Level 1 — Foundations' },
          topics: [
            'docker/container-fundamentals',
            'docker/docker-compose',
            'docker/docker-production',
            'cicd/github-actions',
            'cicd/tekton',
            'iac/terraform-fundamentals'
          ]
        },
        {
          label: { pt: 'Nível 2 — Kubernetes Core', en: 'Level 2 — Kubernetes Core' },
          topics: [
            'cluster-architecture/pods',
            'workloads/deployments',
            'services-networking/services',
            'services-networking/ingress',
            'app-deployment/deployment-strategies',
            'workloads/autoscaling'
          ]
        },
        {
          label: { pt: 'Nível 3 — GitOps & Automação', en: 'Level 3 — GitOps & Automation' },
          topics: [
            'argocd-fundamentals/argocd-architecture',
            'argocd-fundamentals/argocd-applications',
            'argocd-fundamentals/argocd-sync-strategies',
            'argocd-patterns/argocd-app-of-apps',
            'fluxcd/fluxcd-fundamentals',
            'kyverno/kyverno-policies'
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
            'opentelemetry/otel-fundamentals'
          ]
        },
        {
          label: { pt: 'Nível 2 — Kubernetes Operacional', en: 'Level 2 — Operational Kubernetes' },
          topics: [
            'cluster-architecture/pods',
            'cluster-architecture/etcd',
            'troubleshooting/app-failure',
            'troubleshooting/cluster-troubleshooting',
            'storage/pv-pvc',
            'storage/volumes'
          ]
        },
        {
          label: { pt: 'Nível 3 — Stack de Observabilidade', en: 'Level 3 — Observability Stack' },
          topics: [
            'prom-fundamentals/prom-architecture',
            'prom-fundamentals/promql-basics',
            'prom-fundamentals/prom-alerting',
            'prom-grafana/grafana-dashboards',
            'prom-grafana/grafana-alerting',
            'loki/loki-fundamentals',
            'opentelemetry/otel-k8s'
          ]
        },
        {
          label: { pt: 'Nível 4 — Caos & Resiliência', en: 'Level 4 — Chaos & Resilience' },
          topics: [
            'chaos-engineering/chaos-fundamentals',
            'chaos-engineering/chaos-mesh',
            'finops/finops-practices',
            'sre-fundamentals/sre-capacity-planning',
            'sre-operations/sre-deployment-safety'
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
            'cluster-architecture/etcd',
            'cluster-architecture/rbac',
            'workloads/deployments',
            'services-networking/ingress',
            'storage/pv-pvc'
          ]
        },
        {
          label: { pt: 'Nível 2 — Extensibilidade', en: 'Level 2 — Extensibility' },
          topics: [
            'kyverno/kyverno-policies',
            'kyverno/kyverno-advanced',
            'keda/keda-fundamentals',
            'crossplane/crossplane-fundamentals',
            'opa/opa-gatekeeper'
          ]
        },
        {
          label: { pt: 'Nível 3 — Service Mesh & Networking', en: 'Level 3 — Service Mesh & Networking' },
          topics: [
            'cilium-fundamentals/cilium-architecture',
            'cilium-fundamentals/cilium-network-policies',
            'cilium-fundamentals/cilium-hubble',
            'istio-fundamentals/istio-architecture',
            'istio-fundamentals/istio-traffic-mgmt',
            'istio-advanced/istio-security',
            'kong/kong-fundamentals'
          ]
        },
        {
          label: { pt: 'Nível 4 — Platform Tooling', en: 'Level 4 — Platform Tooling' },
          topics: [
            'platform-engineering/idp-concepts',
            'platform-engineering/backstage',
            'platform-engineering/platform-metrics',
            'databases-k8s/db-k8s-fundamentals',
            'iac/terraform-patterns'
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
            'kcna-k8s-fundamentals/k8s-architecture',
            'kcna-cloud-native/cloud-native-fundamentals',
            'aws-cloud-concepts/aws-global-infra',
            'aws-technology-services/compute-services',
            'az104-identity/entra-id',
            'az104-networking/vnet-nsg'
          ]
        },
        {
          label: { pt: 'Nível 2 — AWS Core (SAA)', en: 'Level 2 — AWS Core (SAA)' },
          topics: [
            'aws-high-perf-arch/compute-optimization',
            'aws-resilient-arch/ha-fault-tolerance',
            'aws-secure-arch/network-security',
            'aws-technology-services/storage-databases',
            'aws-new-solutions/serverless-architecture',
            'aws-migration/migration-strategies'
          ]
        },
        {
          label: { pt: 'Nível 3 — Azure Core (AZ-104)', en: 'Level 3 — Azure Core (AZ-104)' },
          topics: [
            'az104-identity/azure-rbac',
            'az104-compute/azure-vms',
            'az104-storage/storage-accounts',
            'az104-networking/azure-lb-appgw',
            'az104-monitor/azure-monitor'
          ]
        },
        {
          label: { pt: 'Nível 4 — Arquitetura de Soluções', en: 'Level 4 — Solutions Architecture' },
          topics: [
            'az305-infrastructure/compute-solutions',
            'az305-infrastructure/network-topology',
            'az305-data/relational-nosql',
            'az305-continuity/bcdr-design',
            'aws-continuous-improvement/operational-excellence',
            'aws-new-solutions/advanced-networking'
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
            'iac/terraform-fundamentals'
          ]
        },
        {
          label: { pt: 'Nível 1 — KCNA', en: 'Level 1 — KCNA' },
          checkpoint: 'kcna',
          topics: [
            'kcna-k8s-fundamentals/k8s-architecture',
            'kcna-k8s-fundamentals/k8s-resources',
            'kcna-orchestration/orchestration-fundamentals',
            'kcna-cloud-native/cloud-native-fundamentals',
            'kcna-observability/observability-fundamentals',
            'kcna-app-delivery/gitops-cicd'
          ]
        },
        {
          label: { pt: 'Nível 2 — CKA', en: 'Level 2 — CKA' },
          checkpoint: 'cka',
          topics: [
            'cluster-architecture/pods',
            'cluster-architecture/etcd',
            'cluster-architecture/rbac',
            'workloads/deployments',
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
            'app-design-build/multi-container',
            'app-design-build/container-images',
            'app-deployment/deployment-strategies',
            'app-deployment/helm',
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
            'kcsa-cluster-security/k8s-networking-security',
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
            'cks-system-hardening/seccomp',
            'cks-microservice-vuln/pod-security-standards',
            'cks-runtime-security/falco',
            'cks-supply-chain/image-signing'
          ]
        },
        {
          label: { pt: 'Nível 6 — Especialização', en: 'Level 6 — Specialization' },
          topics: [
            'cilium-fundamentals/cilium-architecture',
            'cilium-fundamentals/cilium-hubble',
            'istio-fundamentals/istio-architecture',
            'security-tooling/vault-k8s',
            'ai-engineering/llm-fundamentals'
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

    html += '</div></div>';
    container.innerHTML = html;

    // Bind clicks
    container.querySelectorAll('.trail-card__btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-trail');
        _setActiveTrail(id);
        window.location.hash = '#trails/' + id;
      });
    });

    container.querySelectorAll('.trail-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-trail');
        _setActiveTrail(id);
        window.location.hash = '#trails/' + id;
      });
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

    // Levels
    html += '<div class="trail-levels">';

    trail.levels.forEach(function (level, levelIdx) {
      var lp = _levelProgress(level);
      var levelDone = lp.total > 0 && lp.done === lp.total;
      var hasCheckpoint = !!level.checkpoint;

      html += '<div class="trail-level' + (levelDone ? ' trail-level--done' : '') + '">';

      // Level header
      html += '<div class="trail-level__header">';
      html += '<div class="trail-level__number">' + (levelIdx + 1) + '</div>';
      html += '<div class="trail-level__info">';
      html += '<h3>' + level.label[lang] + '</h3>';
      if (lp.total > 0) {
        html += '<span class="trail-level__sub">' + lp.done + '/' + lp.total + ' ' + I18N.t('trailTopicsDone') + '</span>';
      }
      html += '</div>';
      if (levelDone) {
        html += '<span class="trail-level__check">✓</span>';
      }
      html += '</div>';

      // Topics in this level
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
          if (!exists) {
            html += '<span class="trail-topic__coming">' + I18N.t('comingSoon') + '</span>';
          } else {
            html += '<span class="trail-topic__arrow">→</span>';
          }
          html += '</div>';
        });
        html += '</div>';
      } else {
        // Cert/exam level
        html += '<div class="trail-level__certs">';
        html += '<p>' + I18N.t('trailCertLabel') + ' <strong>' + level.topics.join(', ') + '</strong></p>';
        html += '<button class="btn-secondary trail-exam-btn" data-cert="' + (level.exam ? level.exam[0] : '') + '">' + I18N.t('trailExamBtn') + '</button>';
        html += '</div>';
      }

      // Checkpoint badge
      if (hasCheckpoint) {
        html += '<div class="trail-checkpoint">';
        html += '<span class="trail-checkpoint__flag">🏁</span> ';
        html += '<span>' + I18N.t('trailCheckpoint') + ': ' + level.checkpoint.toUpperCase() + '</span>';
        if (levelDone) {
          html += ' <span class="trail-checkpoint__done">✓ ' + I18N.t('trailCheckpointDone') + '</span>';
        }
        html += '</div>';
      }

      html += '</div>'; // trail-level
    });

    html += '</div>'; // trail-levels
    html += '</div>'; // trail-detail

    container.innerHTML = html;

    // Bind topic clicks
    container.querySelectorAll('.trail-topic--clickable').forEach(function (el) {
      el.addEventListener('click', function () {
        var path = el.getAttribute('data-topic');
        if (path) window.location.hash = '#topic/' + path;
      });
    });

    // Bind exam button
    container.querySelectorAll('.trail-exam-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.hash = '#exam';
      });
    });
  }

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
