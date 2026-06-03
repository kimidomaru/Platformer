// Cheatsheet — renders kubectl and Kubernetes command reference
var Cheatsheet = (function () {

  var sections = [
    {
      title: 'Pods & Containers',
      commands: [
        { cmd: 'kubectl get pods -A',
          desc: { pt: 'Lista todos os pods em todos os namespaces', en: 'List all pods across all namespaces' } },
        { cmd: 'kubectl describe pod <name>',
          desc: { pt: 'Detalhes completos de um pod', en: 'Full details of a pod' } },
        { cmd: 'kubectl logs <pod> -c <container>',
          desc: { pt: 'Logs de um container especifico', en: 'Logs of a specific container' } },
        { cmd: 'kubectl exec -it <pod> -- /bin/sh',
          desc: { pt: 'Shell interativo dentro do pod', en: 'Interactive shell inside the pod' } },
        { cmd: 'kubectl run nginx --image=nginx --dry-run=client -o yaml',
          desc: { pt: 'Gera YAML de um pod sem criar', en: 'Generate pod YAML without creating it' } },
        { cmd: 'kubectl delete pod <name> --grace-period=0 --force',
          desc: { pt: 'Forca exclusao imediata do pod', en: 'Force immediate pod deletion' } }
      ]
    },
    {
      title: 'Deployments & ReplicaSets',
      commands: [
        { cmd: 'kubectl create deployment nginx --image=nginx --replicas=3',
          desc: { pt: 'Cria deployment com 3 replicas', en: 'Create deployment with 3 replicas' } },
        { cmd: 'kubectl scale deployment <name> --replicas=5',
          desc: { pt: 'Escala para 5 replicas', en: 'Scale to 5 replicas' } },
        { cmd: 'kubectl rollout status deployment/<name>',
          desc: { pt: 'Acompanha rollout', en: 'Watch rollout status' } },
        { cmd: 'kubectl rollout undo deployment/<name>',
          desc: { pt: 'Reverte para revisao anterior', en: 'Roll back to previous revision' } },
        { cmd: 'kubectl set image deployment/<name> nginx=nginx:1.25',
          desc: { pt: 'Atualiza imagem do container', en: 'Update container image' } }
      ]
    },
    {
      title: 'Services & Networking',
      commands: [
        { cmd: 'kubectl expose deployment <name> --port=80 --type=ClusterIP',
          desc: { pt: 'Cria service ClusterIP', en: 'Create a ClusterIP service' } },
        { cmd: 'kubectl get svc -A',
          desc: { pt: 'Lista todos os services', en: 'List all services' } },
        { cmd: 'kubectl get endpoints',
          desc: { pt: 'Verifica endpoints dos services', en: 'Check service endpoints' } },
        { cmd: 'kubectl get networkpolicy',
          desc: { pt: 'Lista network policies', en: 'List network policies' } },
        { cmd: 'kubectl port-forward svc/<name> 8080:80',
          desc: { pt: 'Port forward local', en: 'Local port forwarding' } }
      ]
    },
    {
      title: 'Storage',
      commands: [
        { cmd: 'kubectl get pv,pvc',
          desc: { pt: 'Lista PV e PVC', en: 'List PVs and PVCs' } },
        { cmd: 'kubectl get storageclass',
          desc: { pt: 'Lista storage classes', en: 'List storage classes' } },
        { cmd: 'kubectl describe pvc <name>',
          desc: { pt: 'Detalhes de um PVC', en: 'Full details of a PVC' } }
      ]
    },
    {
      title: 'Cluster & Nodes',
      commands: [
        { cmd: 'kubectl get nodes -o wide',
          desc: { pt: 'Lista nodes com detalhes', en: 'List nodes with extra details' } },
        { cmd: 'kubectl cordon <node>',
          desc: { pt: 'Marca node como unschedulable', en: 'Mark node as unschedulable' } },
        { cmd: 'kubectl drain <node> --ignore-daemonsets',
          desc: { pt: 'Drena workloads do node', en: 'Drain workloads from node' } },
        { cmd: 'kubectl uncordon <node>',
          desc: { pt: 'Retorna node para scheduling', en: 'Return node to scheduling' } },
        { cmd: 'kubectl top nodes',
          desc: { pt: 'Metricas de uso dos nodes', en: 'Node resource usage metrics' } },
        { cmd: 'kubectl cluster-info',
          desc: { pt: 'Info do cluster', en: 'Cluster information' } }
      ]
    },
    {
      title: 'RBAC & Security',
      commands: [
        { cmd: 'kubectl auth can-i create pods --as=user1',
          desc: { pt: 'Verifica permissao de um usuario', en: 'Check permissions for a user' } },
        { cmd: 'kubectl get clusterroles',
          desc: { pt: 'Lista cluster roles', en: 'List cluster roles' } },
        { cmd: 'kubectl get rolebindings -A',
          desc: { pt: 'Lista role bindings', en: 'List role bindings' } },
        { cmd: 'kubectl create serviceaccount <name>',
          desc: { pt: 'Cria service account', en: 'Create a service account' } }
      ]
    },
    {
      title: 'Troubleshooting',
      commands: [
        { cmd: 'kubectl get events --sort-by=.lastTimestamp',
          desc: { pt: 'Eventos recentes ordenados', en: 'Recent events sorted by timestamp' } },
        { cmd: 'kubectl logs <pod> --previous',
          desc: { pt: 'Logs do container anterior (crashed)', en: 'Logs from previous container (crashed)' } },
        { cmd: 'journalctl -u kubelet',
          desc: { pt: 'Logs do kubelet no node', en: 'Kubelet logs on the node' } },
        { cmd: 'crictl ps -a',
          desc: { pt: 'Lista todos containers (container runtime)', en: 'List all containers (container runtime)' } },
        { cmd: 'kubectl get componentstatuses',
          desc: { pt: 'Status dos componentes do cluster', en: 'Cluster component statuses' } }
      ]
    },
    {
      title: 'ETCD',
      commands: [
        { cmd: 'ETCDCTL_API=3 etcdctl snapshot save backup.db',
          desc: { pt: 'Backup do ETCD', en: 'ETCD snapshot backup' } },
        { cmd: 'ETCDCTL_API=3 etcdctl snapshot restore backup.db',
          desc: { pt: 'Restore do ETCD', en: 'ETCD snapshot restore' } },
        { cmd: 'ETCDCTL_API=3 etcdctl snapshot status backup.db',
          desc: { pt: 'Status do snapshot', en: 'Snapshot status info' } }
      ]
    }
  ];

  function render(container) {
    var lang = typeof I18N !== 'undefined' ? I18N.getLang() : 'pt';

    var html = '<div class="topic-header"><h1>&#128196; ' + I18N.t('cheatsheetTitle') + '</h1></div>';
    html += '<p style="color:var(--text-secondary);margin-bottom:1.5rem">' + I18N.t('cheatsheetSubtitle') + '</p>';

    sections.forEach(function (section) {
      html += '<div class="cheatsheet-section">';
      html += '<h2>' + section.title + '</h2>';
      html += '<div class="cheatsheet-grid">';
      section.commands.forEach(function (cmd) {
        var descText = typeof cmd.desc === 'object'
          ? (cmd.desc[lang] || cmd.desc.pt)
          : cmd.desc;
        html += '<div class="cheatsheet-card">';
        html += '<div class="cmd">' + cmd.cmd + '</div>';
        html += '<div class="desc">' + descText + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    });

    container.innerHTML = html;
  }

  return { render: render };
})();
