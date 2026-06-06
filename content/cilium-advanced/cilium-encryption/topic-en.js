window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-advanced/cilium-encryption'] = {
  theory: `# Cilium: Transparent Encryption (WireGuard & IPsec)

## Relevance
> In regulated environments (PCI-DSS, HIPAA) or untrusted networks, **pod-to-pod** traffic must be encrypted in transit. Cilium offers **transparent encryption** at the data layer, without changing the application, via **WireGuard** (recommended) or **IPsec**. It is one of the most common enterprise requirements and was missing from most study stacks.

## Why transparent encryption?

- **Compliance** — many frameworks require in-transit encryption even inside the cluster (east-west).
- **Zero-trust** — do not trust the network between nodes (multi-tenant, cloud, on-prem with shared switches).
- **Transparent** — the app does not change; the Cilium dataplane encrypts/decrypts automatically between nodes.

\`\`\`
Pod A (node1)  --[ plaintext ]-->  Cilium agent (node1)
                                        |
                                  [ WireGuard tunnel ]   <- encrypted on the wire
                                        v
Pod B (node2)  <--[ plaintext ]--  Cilium agent (node2)
\`\`\`

## WireGuard (recommended)

Modern, simple, fast and **in the kernel**. Keys are generated and rotated automatically by Cilium; each node has a key pair and the public key is announced via CiliumNode.

\`\`\`bash
# Enable on install/upgrade
helm upgrade cilium cilium/cilium -n kube-system \\
  --set encryption.enabled=true \\
  --set encryption.type=wireguard

kubectl -n kube-system rollout restart ds/cilium
\`\`\`

\`\`\`bash
# Check encryption status
kubectl exec -n kube-system ds/cilium -- cilium status | grep Encryption
# Expected: Encryption: Wireguard [cilium_wg0 ...]

# Per-node detail (peers and keys)
kubectl exec -n kube-system ds/cilium -- cilium-dbg encrypt status
\`\`\`

> Cilium creates the \`cilium_wg0\` interface. Pod-to-pod traffic **between nodes** goes through it encrypted. Traffic within the same node does not need encryption (it does not leave the wire).

## node-to-node encryption (encryptNode)

By default, WireGuard encrypts **pod-to-pod** traffic. To also encrypt **host/node-to-node** traffic (e.g. host-network process traffic), enable it explicitly:

\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set encryption.enabled=true \\
  --set encryption.type=wireguard \\
  --set encryption.nodeEncryption=true
\`\`\`

| Scope | WireGuard default | With nodeEncryption |
|-------|-------------------|---------------------|
| Pod-to-pod between nodes | encrypted | encrypted |
| Host-network / node-to-node | **plaintext** | encrypted |

## IPsec (legacy/FIPS alternative)

Use IPsec when you need FIPS-validated algorithms or specific compatibility. It is more complex (requires a Secret with the PSK key and manual/managed rotation).

\`\`\`bash
# Create the IPsec key
kubectl create -n kube-system secret generic cilium-ipsec-keys \\
  --from-literal=keys="3 rfc4106(gcm(aes)) $(openssl rand -hex 20) 128"

helm upgrade cilium cilium/cilium -n kube-system \\
  --set encryption.enabled=true \\
  --set encryption.type=ipsec
\`\`\`

## WireGuard vs IPsec

| | WireGuard | IPsec |
|---|-----------|-------|
| Complexity | low (automatic keys) | high (PSK Secret, rotation) |
| Performance | high (kernel, modern) | good, but more overhead |
| FIPS | no | yes (validated algorithms) |
| Cilium recommendation | **default** | when required by compliance |

## Validating that traffic is encrypted

\`\`\`bash
# 1. General status
kubectl exec -n kube-system ds/cilium -- cilium status | grep -i encryption

# 2. Capture traffic on the node physical interface and confirm there is NO plaintext
#    (you should see WireGuard/UDP 51871, not plaintext HTTP)
tcpdump -ni eth0 'udp port 51871' -c 5      # WireGuard
# For IPsec, look for the ESP protocol:
tcpdump -ni eth0 'esp' -c 5

# 3. Confirm WireGuard handshake/peers
kubectl exec -n kube-system ds/cilium -- cilium-dbg encrypt status
\`\`\`

## Common Mistakes

1. **Forgetting to restart the agents** after enabling — the DaemonSet must reload.
2. **Assuming host-network is encrypted** — without \`nodeEncryption\`, only pod-to-pod is encrypted.
3. **MTU** — the tunnel overhead reduces the effective MTU; path MTU issues can cause timeouts on large payloads.
4. **Mixing types** — switching between wireguard and ipsec needs care; do not run both at once.
5. **IPsec without the correct Secret** — a malformed key leaves the agents in error.

## Killer.sh Style Challenge

> On a Cilium cluster with 2+ nodes:
>
> 1. Enable transparent encryption with WireGuard.
> 2. Confirm via \`cilium status\` that Encryption: Wireguard is active.
> 3. Have two Pods on different nodes exchange HTTP traffic.
> 4. Capture the traffic on the node interface and prove it is encrypted (WireGuard UDP), not plaintext.
>
> Hint: \`--set encryption.enabled=true --set encryption.type=wireguard\`, then \`cilium-dbg encrypt status\` and \`tcpdump\`.
`,

  quiz: [
    {
      question: 'Which transparent encryption method does Cilium RECOMMEND for most cases?',
      options: [
        'IPsec, because it is FIPS validated',
        'WireGuard, because it is simple, fast and with automatically managed keys',
        'TLS at the application layer',
        'mTLS via sidecar'
      ],
      correct: 1,
      explanation: 'Cilium recommends WireGuard as the default: it runs in the kernel, is modern and performant, and Cilium manages/rotates the keys automatically (each node has a pair, public key announced via CiliumNode). IPsec is reserved for FIPS requirements or specific compatibility.',
      reference: 'Sections WireGuard and WireGuard vs IPsec.'
    },
    {
      question: 'With WireGuard enabled in default mode, which traffic is NOT encrypted?',
      options: [
        'Pod-to-pod traffic between different nodes',
        'Host-network / node-to-node traffic (unless nodeEncryption is enabled)',
        'None — everything is encrypted by default',
        'Only DNS traffic'
      ],
      correct: 1,
      explanation: 'By default WireGuard encrypts pod-to-pod traffic between nodes. Host-network process traffic (node-to-node) is only encrypted if you explicitly enable encryption.nodeEncryption=true. Traffic within the same node does not need encryption (it does not leave the wire).',
      reference: 'Section node-to-node encryption (encryptNode).'
    },
    {
      question: 'Which interface does Cilium create when enabling WireGuard?',
      options: [
        'cilium_vxlan',
        'cilium_wg0',
        'wg-crypt0',
        'cilium_host'
      ],
      correct: 1,
      explanation: 'Cilium creates the cilium_wg0 interface for the WireGuard tunnel. Pod-to-pod traffic between nodes is routed through it encrypted. Confirm with cilium status (Encryption line) and cilium-dbg encrypt status.',
      reference: 'Section WireGuard.'
    },
    {
      question: 'In which scenario is IPsec still preferable to WireGuard in Cilium?',
      options: [
        'Always, because it is faster',
        'When FIPS-validated algorithms or specific compliance compatibility are required',
        'On single-node clusters',
        'When there is no kube-proxy'
      ],
      correct: 1,
      explanation: 'IPsec is the choice when compliance requires FIPS-validated cryptographic algorithms. The cost is more complexity: it requires a Secret with the PSK key and rotation management, unlike WireGuard which manages keys automatically.',
      reference: 'Sections IPsec and WireGuard vs IPsec.'
    },
    {
      question: 'How do you practically prove that traffic between nodes is actually encrypted?',
      options: [
        'By looking at the application logs',
        'By capturing traffic on the node physical interface with tcpdump and confirming WireGuard (UDP) or ESP, with no plaintext payload',
        'By checking the number of Pod replicas',
        'By running kubectl top nodes'
      ],
      correct: 1,
      explanation: 'The definitive validation is capturing on the physical interface (e.g. tcpdump -ni eth0 udp port 51871 for WireGuard, or esp for IPsec). You should see the encrypted tunnel protocol, not plaintext HTTP requests. cilium-dbg encrypt status confirms peers/handshakes.',
      reference: 'Section Validating that traffic is encrypted.'
    },
    {
      question: 'Why can large payloads time out after enabling transparent encryption?',
      options: [
        'WireGuard limits the number of connections',
        'The tunnel overhead reduces the effective MTU; path MTU issues can fragment/drop large packets',
        'Encryption disables TCP',
        'Pods lose their IP'
      ],
      correct: 1,
      explanation: 'Encapsulating in a tunnel adds headers and reduces the MTU available for the payload. If path MTU is not handled correctly, large packets can be dropped, causing intermittent timeouts. Adjusting the Cilium MTU fixes it.',
      reference: 'Section Common Mistakes (item 3).'
    },
    {
      question: 'Who manages the cryptographic keys in Cilium WireGuard mode?',
      options: [
        'The administrator, manually via a Secret',
        'Cilium itself, generating and rotating keys automatically per node',
        'cert-manager',
        'The kube-apiserver'
      ],
      correct: 1,
      explanation: 'In WireGuard, Cilium generates a key pair per node automatically and announces the public key via the CiliumNode object. There is no manual Secret. This contrasts with IPsec, where you create and manage the cilium-ipsec-keys Secret.',
      reference: 'Section WireGuard.'
    }
  ],

  flashcards: [
    {
      front: 'How to enable transparent encryption with WireGuard in Cilium?',
      back: '```bash\nhelm upgrade cilium cilium/cilium -n kube-system \\\n  --set encryption.enabled=true \\\n  --set encryption.type=wireguard\nkubectl -n kube-system rollout restart ds/cilium\n```\n\nCilium creates `cilium_wg0` and manages keys automatically. Verify with `cilium status | grep Encryption`.'
    },
    {
      front: 'WireGuard default scope vs nodeEncryption',
      back: '| Traffic | Default | nodeEncryption=true |\n|---------|---------|---------------------|\n| Pod-to-pod between nodes | encrypted | encrypted |\n| Host-network / node-to-node | **plaintext** | encrypted |\n\nBy default only pod-to-pod is encrypted. To encrypt host-network, turn on `encryption.nodeEncryption=true`.'
    },
    {
      front: 'WireGuard vs IPsec in Cilium',
      back: '**WireGuard** (default): automatic keys, kernel, fast, simple. No FIPS.\n\n**IPsec**: requires `cilium-ipsec-keys` Secret (PSK), managed rotation, more overhead, **FIPS validated**.\n\nChoose IPsec only when compliance requires FIPS-validated algorithms.'
    },
    {
      front: 'How to check encryption status?',
      back: '```bash\n# summary\nkubectl exec -n kube-system ds/cilium -- \\\n  cilium status | grep Encryption\n# Encryption: Wireguard [cilium_wg0 ...]\n\n# detail (peers/keys)\nkubectl exec -n kube-system ds/cilium -- \\\n  cilium-dbg encrypt status\n```'
    },
    {
      front: 'How to PROVE traffic is encrypted on the wire?',
      back: 'Capture on the node physical interface:\n\n```bash\n# WireGuard (UDP 51871)\ntcpdump -ni eth0 \'udp port 51871\' -c 5\n# IPsec (ESP protocol)\ntcpdump -ni eth0 \'esp\' -c 5\n```\n\nYou should see the encrypted tunnel protocol, never plaintext HTTP/payload.'
    },
    {
      front: 'IPsec setup in Cilium',
      back: '```bash\nkubectl create -n kube-system secret generic cilium-ipsec-keys \\\n  --from-literal=keys="3 rfc4106(gcm(aes)) $(openssl rand -hex 20) 128"\n\nhelm upgrade cilium cilium/cilium -n kube-system \\\n  --set encryption.enabled=true \\\n  --set encryption.type=ipsec\n```\n\nUnlike WireGuard, the key (PSK) is managed manually via a Secret.'
    },
    {
      front: 'Transparent encryption pitfalls',
      back: '1. Forgetting to **restart** agents after enabling.\n2. Thinking **host-network** is encrypted without `nodeEncryption`.\n3. **MTU**: tunnel overhead can cause timeouts on large payloads (path MTU).\n4. **IPsec** with a malformed Secret leaves the agent in error.\n5. Do not run WireGuard and IPsec at the same time.'
    }
  ],

  lab: {
    scenario: 'Enable WireGuard in Cilium, verify the encryption status and prove with packet capture that pod-to-pod traffic between nodes is encrypted.',
    objective: 'Master enabling and VALIDATING transparent encryption — the point that comes up in compliance audits.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Enable WireGuard and confirm status',
        instruction: 'Enable WireGuard encryption via Helm and confirm that Cilium reports Encryption: Wireguard.',
        hints: ['encryption.type=wireguard', 'cilium status | grep Encryption'],
        solution: `\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --reuse-values \\
  --set encryption.enabled=true \\
  --set encryption.type=wireguard

kubectl -n kube-system rollout restart ds/cilium
kubectl -n kube-system rollout status ds/cilium

kubectl exec -n kube-system ds/cilium -- cilium status | grep -i encryption
\`\`\``,
        verify: `\`\`\`bash
kubectl exec -n kube-system ds/cilium -- cilium status | grep -i encryption
# Expected: Encryption: Wireguard [cilium_wg0 (Pubkey: ...)]

kubectl exec -n kube-system ds/cilium -- cilium-dbg encrypt status
# Expected: list of WireGuard peers (1 per other node)
\`\`\``
      },
      {
        title: 'Generate pod-to-pod traffic between nodes',
        instruction: 'Create two Pods forcing them onto different nodes and generate HTTP traffic between them.',
        hints: ['Use nodeName or anti-affinity', 'curl from one pod to the other IP'],
        solution: `\`\`\`bash
# Server
kubectl run server --image=nginx
kubectl expose pod server --port=80

# Client on another node (adjust nodeName for your cluster)
NODE2=$(kubectl get nodes -o jsonpath='{.items[1].metadata.name}')
kubectl run client --image=curlimages/curl --overrides="{\\"spec\\":{\\"nodeName\\":\\"$NODE2\\"}}" \\
  --command -- sleep 3600

# Generate traffic
kubectl exec client -- curl -s http://server.default.svc.cluster.local | head -3
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod server client -o wide
# Expected: server and client on DIFFERENT nodes

kubectl exec client -- curl -s -o /dev/null -w "%{http_code}\\n" http://server
# Expected: 200
\`\`\``
      },
      {
        title: 'Prove that traffic is encrypted',
        instruction: 'Capture traffic on the node physical interface and confirm it appears as WireGuard, not plaintext HTTP.',
        hints: ['tcpdump on the node eth0', 'WireGuard uses UDP 51871'],
        solution: `\`\`\`bash
# On the node where the client runs (via debug pod or SSH):
# Capture WireGuard packets
tcpdump -ni eth0 'udp port 51871' -c 5

# For contrast, try to find plaintext HTTP (should NOT find nginx payload)
tcpdump -ni eth0 -A 'tcp port 80' -c 5 | grep -i 'nginx\\|HTTP' || echo "No plaintext found (expected)"
\`\`\``,
        verify: `\`\`\`bash
# Expected: UDP 51871 packets (WireGuard) when generating traffic between pods
# and absence of plaintext HTTP payload on the physical interface

# Cleanup
kubectl delete pod server client
kubectl delete svc server
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Enabled encryption but traffic is still plaintext',
      difficulty: 'medium',
      symptom: 'After setting encryption.enabled=true, packet capture still shows plaintext HTTP payload between Pods, or cilium status does not show Encryption active.',
      diagnosis: `\`\`\`bash
# 1. Did the agents reload the config?
kubectl exec -n kube-system ds/cilium -- cilium status | grep -i encryption
kubectl -n kube-system get pods -l k8s-app=cilium

# 2. Are the Pods on the SAME node? (intra-node traffic does not use the tunnel)
kubectl get pods -o wide

# 3. Is the traffic host-network? (not encrypted without nodeEncryption)
kubectl get pod <pod> -o jsonpath='{.spec.hostNetwork}'
\`\`\``,
      solution: `**Common causes:**

1. **Agents not restarted** — enabling the flag requires reloading the DaemonSet:
\`\`\`bash
kubectl -n kube-system rollout restart ds/cilium
\`\`\`

2. **Pods on the same node** — intra-node traffic does not leave the wire and does not pass through the WireGuard tunnel. Force the Pods onto different nodes to validate.

3. **Host-network traffic** — processes with hostNetwork: true are only encrypted with \`encryption.nodeEncryption=true\`. Enable it if you need to cover that traffic.

4. **Captured on the wrong interface** — capture on the node PHYSICAL interface (eth0), not the Pod/lxc interface, to see the already-encapsulated packets.

**Prevention:** always validate with Pods on different nodes and with tcpdump on the physical interface.`
    },
    {
      title: 'Intermittent timeouts on large requests after enabling WireGuard',
      difficulty: 'hard',
      symptom: 'Small connections work, but large uploads/downloads or bulky responses hang or time out after encryption was enabled.',
      diagnosis: `\`\`\`bash
# Classic path MTU symptom: small ok, large fails
# 1. Check the MTU configured in Cilium
kubectl exec -n kube-system ds/cilium -- cilium status --verbose | grep -i mtu

# 2. Test with increasing sizes
kubectl exec client -- ping -M do -s 1400 <server-ip>
kubectl exec client -- ping -M do -s 1472 <server-ip>   # may fail
\`\`\``,
      solution: `**Cause:** WireGuard encapsulation adds header overhead, reducing the effective MTU. If path MTU discovery does not work (ICMP blocked somewhere), large packets are silently dropped -> timeout.

**Fixes:**

1. **Adjust the Cilium MTU** to accommodate the tunnel overhead:
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system --reuse-values \\
  --set MTU=1380     # example; adjust for the underlying network
kubectl -n kube-system rollout restart ds/cilium
\`\`\`

2. **Ensure ICMP (needed for PMTUD) is not blocked** between nodes by firewalls/NetworkPolicies.

3. **TCP MSS clamping** — in some environments, adjusting the MSS fixes it without changing the global MTU.

**Prevention:** when enabling any tunnel/encryption, plan the MTU from the start considering the overhead (WireGuard ~ 80 bytes).`
    }
  ]
};
