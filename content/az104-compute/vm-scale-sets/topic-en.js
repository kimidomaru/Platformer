window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az104-compute/vm-scale-sets'] = {
  theory: `# VM Scale Sets & Autoscaling

## Exam Relevance
> Estimated weight **8-10%** on AZ-104. Metric-based autoscaling and VMSS configuration appear in high-availability scenarios.

## Core Concepts

### VM Scale Sets (VMSS)
Manages a group of identical VMs with:
- **Autoscaling** based on metrics (CPU, memory, custom)
- **Rolling updates**: gradual updates with no downtime
- **Load Balancer or Application Gateway** in front
- **Uniform mode**: identical VMs (for stateless workloads)
- **Flex mode**: supports different sizes/images

### Autoscaling Rules
Condition → Action:
\`\`\`
IF avg CPU > 70% for 10 minutes
THEN add 2 instances
WAIT 5 minutes before next evaluation (cooldown)

IF avg CPU < 30% for 10 minutes
THEN remove 1 instance
\`\`\`

**Important settings:**
- **Min count**: minimum VMs always active
- **Max count**: maximum VM limit
- **Default count**: initial count if metrics are unavailable
- **Cooldown period**: wait time after a scale out/in before another action

### Upgrade Policy
How VMs are updated when the image/configuration changes:
- **Automatic**: Azure updates instances immediately
- **Rolling**: updates in batches, keeping a minimum % of healthy instances
- **Manual**: you control when each instance is updated

### Spot Instances in VMSS
- Uses Azure excess capacity with up to **90% discount**
- Can be evicted with 30 seconds notice
- Ideal for: batch processing, rendering, interruption-tolerant workloads
- **Eviction policy**: Delete or Deallocate

## Essential Commands (Azure CLI)

\`\`\`bash
# Create a simple VMSS
az vmss create \\
  --name myVMSS \\
  --resource-group myRG \\
  --image Ubuntu2204 \\
  --vm-sku Standard_B2s \\
  --instance-count 2 \\
  --admin-username azureuser \\
  --generate-ssh-keys \\
  --load-balancer myLB

# Configure autoscaling on the VMSS
az monitor autoscale create \\
  --resource-group myRG \\
  --resource myVMSS \\
  --resource-type Microsoft.Compute/virtualMachineScaleSets \\
  --name myAutoscale \\
  --min-count 2 \\
  --max-count 10 \\
  --count 2

# Add a scale-out rule (CPU > 70%)
az monitor autoscale rule create \\
  --resource-group myRG \\
  --autoscale-name myAutoscale \\
  --condition "Percentage CPU > 70 avg 5m" \\
  --scale out 2 \\
  --cooldown 5

# Add a scale-in rule (CPU < 30%)
az monitor autoscale rule create \\
  --resource-group myRG \\
  --autoscale-name myAutoscale \\
  --condition "Percentage CPU < 30 avg 5m" \\
  --scale in 1 \\
  --cooldown 5

# Scale manually
az vmss scale --name myVMSS --resource-group myRG --new-capacity 5

# List instances
az vmss list-instances --name myVMSS --resource-group myRG \\
  --query "[].{ID:instanceId,State:provisioningState}" -o table
\`\`\`

## Common Mistakes

1. **Min > Max**: invalid configuration that prevents autoscaling.
2. **Cooldown too short**: flapping (scaling up and down repeatedly) — increase cooldown to 5–10 minutes.
3. **Health probe not configured**: VMSS with LB and no health probe cannot detect bad instances.
4. **Spot VMs in critical production**: spot can be evicted at any time — never use for workloads that cannot tolerate interruption.

## Killer.sh Style Challenge

> A web application has unpredictable traffic with 5x spikes. Configure a VMSS with autoscaling that keeps at least 2 instances always active, can scale up to 20, and adds 3 instances when CPU > 75% for 5 minutes.
>
> **Answer**: VMSS with min=2, max=20, default=2. Scale-out rule: CPU > 75%, avg 5m, scale out +3, cooldown 5m. Scale-in rule: CPU < 30%, avg 10m, scale in -1, cooldown 10m.
`,

  quiz: [
    {
      question: 'What is the "cooldown period" in an Azure autoscaling rule?',
      options: [
        'The time it takes for a VM to initialize after being created',
        'A waiting period after a scale out/in action before executing the next scaling evaluation',
        'The maximum time autoscaling stays active before resetting',
        'The interval between VM health checks'
      ],
      correct: 1,
      explanation: 'The cooldown period is a mandatory waiting time after a scaling action before another one can run. This prevents "flapping" — scaling up and down repeatedly in response to quick metric fluctuations. A cooldown of 5–10 minutes is common to give new instances time to start and distribute the load.',
      reference: 'Cooldown = anti-flapping protection. Too short = unstable scaling. Too long = slow reaction to spikes.'
    },
    {
      question: 'What is the difference between the "Automatic" and "Rolling" upgrade policies in a VMSS?',
      options: [
        'Automatic is safer; Rolling is faster',
        'Automatic updates all instances immediately; Rolling updates in batches while maintaining availability',
        'Rolling requires downtime; Automatic does not',
        'There is no practical difference between the two modes'
      ],
      correct: 1,
      explanation: 'Automatic updates all instances immediately after a configuration/image change — it can cause downtime if all are updated at once. Rolling updates in batches (e.g. 20% of instances at a time), keeping a minimum percentage of healthy instances during the update — zero downtime.',
      reference: 'Production = Rolling (gradual, no downtime). Dev/Test = Automatic (simpler). Manual = you control when to update.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 4 key autoscaling settings in a VMSS?',
      back: '1. **Min count** — minimum VMs always active (even with low CPU)\n2. **Max count** — upper limit that autoscaling can create\n3. **Default count** — count when metrics are not available\n4. **Cooldown period** — wait time after a scale action before next evaluation\n\nPractical rule: min ≥ 2 for HA, cooldown 5–10 min for stability.'
    },
    {
      front: 'What are Spot Instances in VMSS and when to use them?',
      back: '**Spot Instances** use Azure excess capacity with discounts of up to **90%**.\n\n**Characteristics:**\n- Can be **evicted** with 30 seconds notice\n- Eviction policy: Delete or Deallocate\n- Variable or fixed price (max price)\n\n**When to use:**\n✅ Interruption-tolerant batch processing\n✅ 3D rendering, ML training\n✅ Load and performance testing\n\n**Never use for:**\n❌ Production web servers\n❌ Databases\n❌ Any workload that cannot be interrupted'
    }
  ],

  lab: {
    scenario: 'Configure a VM Scale Set with autoscaling for the TechNova application.',
    objective: 'Create a VMSS, configure autoscaling rules and verify the behavior.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create the VMSS',
        instruction: 'Create an Ubuntu VMSS with 2 initial instances.',
        hints: ['\`az vmss create\` with \`--instance-count 2\`'],
        solution: `\`\`\`bash
az group create --name rg-vmss-lab --location eastus
az vmss create \\
  --name app-vmss \\
  --resource-group rg-vmss-lab \\
  --image Ubuntu2204 \\
  --vm-sku Standard_B2s \\
  --instance-count 2 \\
  --admin-username azureuser \\
  --generate-ssh-keys
\`\`\``,
        verify: `\`\`\`bash
az vmss list-instances --name app-vmss --resource-group rg-vmss-lab \\
  --query "[].{ID:instanceId,State:provisioningState}" -o table
# Expected output: 2 instances with state Succeeded
\`\`\``
      },
      {
        title: 'Configure autoscaling',
        instruction: 'Configure autoscaling: min=2, max=5, scale out when CPU > 70%.',
        hints: ['\`az monitor autoscale create\` then \`az monitor autoscale rule create\`'],
        solution: `\`\`\`bash
VMSS_ID=$(az vmss show --name app-vmss --resource-group rg-vmss-lab --query id -o tsv)

az monitor autoscale create \\
  --resource-group rg-vmss-lab \\
  --resource $VMSS_ID \\
  --name vmss-autoscale \\
  --min-count 2 --max-count 5 --count 2

az monitor autoscale rule create \\
  --resource-group rg-vmss-lab \\
  --autoscale-name vmss-autoscale \\
  --condition "Percentage CPU > 70 avg 5m" \\
  --scale out 1 --cooldown 5

az monitor autoscale rule create \\
  --resource-group rg-vmss-lab \\
  --autoscale-name vmss-autoscale \\
  --condition "Percentage CPU < 30 avg 10m" \\
  --scale in 1 --cooldown 10
\`\`\``,
        verify: `\`\`\`bash
az monitor autoscale show --name vmss-autoscale --resource-group rg-vmss-lab \\
  --query "{Min:profiles[0].capacity.minimum,Max:profiles[0].capacity.maximum,Rules:length(profiles[0].rules)}" -o table
# Expected: Min=2, Max=5, Rules=2
\`\`\``
      },
      {
        title: 'Cleanup',
        instruction: 'Delete the Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-vmss-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-vmss-lab 2>/dev/null || echo "RG deleted"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Autoscaling is not adding instances despite high CPU',
      difficulty: 'medium',
      symptom: 'VM CPU is consistently above 80%, but the VMSS is not adding new instances.',
      diagnosis: `\`\`\`bash
# Check the autoscale configuration
az monitor autoscale show --name myAutoscale --resource-group myRG \\
  --query "{Min:profiles[0].capacity.minimum,Max:profiles[0].capacity.maximum,Default:profiles[0].capacity.default}" -o table

# Check current VMSS instance count
az vmss list-instances --name myVMSS --resource-group myRG --query "length(@)" -o tsv

# Check autoscale activity history
az monitor activity-log list \\
  --resource-group myRG \\
  --query "[?contains(operationName.value,'autoscale')].{Time:eventTimestamp,Op:operationName.value,Status:status.value}" \\
  -o table
\`\`\``,
      solution: `**Possible causes:**

1. **VMSS is already at maximum**: check whether \`current count == max count\`. Increase the max.

2. **Metrics unavailable**: if Azure Monitor has no recent metrics, it uses the \`default count\` instead of scaling. Check whether Log/Metric Diagnostics is enabled.

3. **Misonfigured rule**: check the exact condition — "avg" vs "max", time window (5m, 10m), metric type.

4. **Cooldown active**: if a scale-out was triggered recently, the cooldown may be blocking a new action.

5. **Subscription quota reached**: check the core/VM limit in the subscription with \`az vm list-usage --location eastus\`.`
    }
  ]
};
