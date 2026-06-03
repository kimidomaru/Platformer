window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['platform-engineering/idp-concepts'] = {
  theory: `
# Internal Developer Platforms (IDPs)

## Relevance
Platform Engineering is the discipline of designing and building internal toolchains and workflows that enable developer self-service. An IDP (Internal Developer Platform) reduces cognitive load, standardizes operations, and accelerates delivery. It is the next step beyond DevOps and SRE.

## Fundamental Concepts

### What is Platform Engineering?

Platform Engineering is the practice of building and maintaining internal platforms that abstract infrastructure complexity for development teams:

\`\`\`
Without Platform:
  Dev -> "How do I deploy?" -> Ticket -> Ops -> 3 days

With Platform:
  Dev -> Self-Service Portal -> Deploy in 5 minutes
\`\`\`

### Why Platform Engineering?

| Problem (Traditional DevOps) | Solution (Platform Eng) |
|------------------------------|-------------------------|
| High cognitive load for devs | Abstractions and golden paths |
| Inconsistency across teams | Standardized templates |
| Tickets for basic infra | Automated self-service |
| Shadow IT and workarounds | Attractive, useful platform |
| Scale: N teams x M tools | Unified platform |

### Team Topologies and Platform Teams

Based on the book "Team Topologies" (Skelton & Pais):

\`\`\`
┌────────────────────────────────────┐
│        Stream-Aligned Teams        │
│  (product/feature teams)           │
│        ▲              ▲            │
│        │              │            │
│   ┌────┴────┐    ┌────┴────┐      │
│   │Platform │    │Enabling │      │
│   │  Team   │    │  Team   │      │
│   └─────────┘    └─────────┘      │
│                                    │
│   ┌─────────────────────┐         │
│   │ Complicated-Subsystem│         │
│   │       Team           │         │
│   └─────────────────────┘         │
└────────────────────────────────────┘
\`\`\`

**Platform Team:** Builds and maintains the internal platform. Treats the platform as a product.

**Principle:** "Thinnest Viable Platform" — the smallest platform that solves real developer problems.

### Layers of an IDP

\`\`\`
┌─────────────────────────────────────┐
│  5. Developer Portal (Backstage)    │  <- Interface
├─────────────────────────────────────┤
│  4. Golden Paths & Templates        │  <- Experience
├─────────────────────────────────────┤
│  3. Platform API (Crossplane, K8s)  │  <- Abstractions
├─────────────────────────────────────┤
│  2. Delivery (ArgoCD, Flux, CI/CD)  │  <- Automation
├─────────────────────────────────────┤
│  1. Infra (K8s, Cloud, Terraform)   │  <- Foundation
└─────────────────────────────────────┘
\`\`\`

### IDP Design Principles

1. **Platform as Product** — treat the platform as a product with users (devs), roadmap, and feedback
2. **Self-Service** — devs can provision without tickets or dependencies
3. **Golden Paths** — optimized paths that are secure by default, not mandatory
4. **Abstraction** — hide complexity without removing flexibility
5. **Documentation** — quality docs as part of the platform
6. **Observability** — usage and satisfaction metrics for the platform

### Maturity Model

| Level | Characteristics | Example Tools |
|-------|----------------|---------------|
| 1. Manual | Tickets, wiki docs, ad-hoc scripts | Confluence, Jira |
| 2. Standardized | Templates, basic CI/CD | Helm charts, Jenkins |
| 3. Self-Service | Portal, automated provisioning | Backstage, ArgoCD |
| 4. Optimized | Metrics, feedback loop, continuous improvement | DORA metrics, surveys |
| 5. Autonomous | AI-assisted, auto-healing, predictive | ML ops, AIOps |

### CNCF Platform Engineering Maturity Model

The CNCF defines 4 aspects of maturity:

1. **Investment** — how the organization invests in the platform
2. **Adoption** — level of developer adoption
3. **Interfaces** — quality of interfaces (portal, CLI, API)
4. **Operations** — how the platform is operated and maintained

### Ecosystem Tools

| Layer | Tools |
|-------|-------|
| Portal | Backstage, Port, Cortex, OpsLevel |
| Templates | Cookiecutter, Yeoman, Scaffolder |
| GitOps | ArgoCD, Flux, Kargo |
| Platform API | Crossplane, KubeVela, Kratix |
| Infra | Terraform, Pulumi, CDK |
| Observability | Prometheus, Grafana, Datadog |
| Security | Vault, cert-manager, OPA |
| CI/CD | GitHub Actions, GitLab CI, Tekton |

### Common Mistakes

1. **Building too much** — starting with the "dream platform" instead of the minimum viable
2. **Ignoring feedback** — not listening to the developers who use the platform
3. **Forcing adoption** — golden paths should be attractive, not mandatory
4. **Team too small** — platform team needs its own capacity
5. **No metrics** — not measuring usage, satisfaction, and impact

## Killer.sh Style Challenge

> **Conceptual scenario:** Design an IDP for a company with 50 developers and 10 microservices. Define: (1) which golden paths to offer, (2) which tools to compose each layer, (3) how to measure platform success.
`,
  quiz: [
    {
      question: 'What is an Internal Developer Platform (IDP)?',
      options: [
        'A programming framework',
        'An internal platform that enables self-service and abstracts infrastructure complexity for developers',
        'A public cloud service',
        'A monitoring system'
      ],
      correct: 1,
      explanation: 'An IDP is an internal platform built by the Platform Team that allows developers to provision resources, deploy applications, and manage services autonomously.',
      reference: 'Related concept: The IDP treats the platform as a product, with devs as users.'
    },
    {
      question: 'What does "Thinnest Viable Platform" mean?',
      options: [
        'The cheapest possible platform',
        'The smallest platform that solves real developer problems without unnecessary overhead',
        'A platform without a graphical interface',
        'A platform that runs on a single server'
      ],
      correct: 1,
      explanation: 'Thinnest Viable Platform (from the book Team Topologies) means building only what is necessary to solve real developer pain points. Start small and iterate based on feedback.',
      reference: 'Related concept: Start with golden paths for the most common use cases.'
    },
    {
      question: 'What are Golden Paths in the context of Platform Engineering?',
      options: [
        'Optimized network routes',
        'Pre-defined and optimized paths for common tasks (deploy, create service, etc.) that are recommended but not mandatory',
        'Fixed CI/CD pipelines',
        'Mandatory security rules'
      ],
      correct: 1,
      explanation: 'Golden Paths are standardized and optimized workflows that the platform offers. They are "the happy path" — secure, tested, and efficient — but devs can use alternatives if needed.',
      reference: 'Related concept: Golden Paths include templates, pipelines, and pre-defined configurations.'
    },
    {
      question: 'What is the role of the Platform Team according to Team Topologies?',
      options: [
        'Managing infrastructure tickets',
        'Building and maintaining the internal platform, treating it as an internal product',
        'Developing business features',
        'Manually deploying for all teams'
      ],
      correct: 1,
      explanation: 'The Platform Team builds and maintains the internal platform. They treat the platform as a product: have a roadmap, collect feedback, measure satisfaction, and iterate continuously.',
      reference: 'Related concept: Stream-aligned teams are the "customers" of the Platform Team.'
    },
    {
      question: 'Which layer of an IDP is responsible for the interface with developers?',
      options: [
        'Platform API',
        'Developer Portal (e.g., Backstage)',
        'Delivery layer (ArgoCD)',
        'Infrastructure (Kubernetes)'
      ],
      correct: 1,
      explanation: 'The Developer Portal (like Backstage) is the interface layer where devs interact with the platform: browse services, create new projects via templates, consult docs, and monitor health.',
      reference: 'Related concept: The 5 layers: Infra > Delivery > Platform API > Golden Paths > Portal.'
    },
    {
      question: 'What is the main anti-pattern in Platform Engineering?',
      options: [
        'Using Kubernetes',
        'Building the entire platform before validating with real users',
        'Documenting the platform',
        'Measuring DORA metrics'
      ],
      correct: 1,
      explanation: 'The biggest anti-pattern is "build it and they will come" — building a complete platform without validating that it solves real pain points. The correct approach is to start with the minimum viable and iterate.',
      reference: 'Related concept: Thinnest Viable Platform + constant feedback loops.'
    },
    {
      question: 'Which metric is NOT typically used to measure IDP success?',
      options: [
        'DORA metrics (deploy frequency, lead time)',
        'Developer satisfaction (NPS)',
        'Number of lines of code written',
        'Time to onboard a new developer'
      ],
      correct: 2,
      explanation: 'Lines of code do not measure platform effectiveness. Useful metrics include: DORA (deploy frequency, lead time, MTTR, change failure rate), developer NPS, onboarding time, and self-service usage.',
      reference: 'Related concept: SPACE framework (Satisfaction, Performance, Activity, Communication, Efficiency).'
    }
  ],
  flashcards: [
    {
      front: 'What are the 5 layers of an IDP?',
      back: '1. **Infrastructure** — K8s, Cloud, Terraform\n2. **Delivery** — ArgoCD, Flux, CI/CD\n3. **Platform API** — Crossplane, KubeVela, Kratix\n4. **Golden Paths** — Templates, scaffolding\n5. **Developer Portal** — Backstage, Port\n\nEach layer abstracts the one below. Devs primarily interact with layers 4 and 5.'
    },
    {
      front: 'What is Team Topologies and how does it relate to Platform Eng?',
      back: '**Team Topologies** (Skelton & Pais) defines 4 team types:\n\n1. **Stream-Aligned** — delivers features (platform customer)\n2. **Platform** — builds/maintains the platform\n3. **Enabling** — helps teams adopt new technologies\n4. **Complicated-Subsystem** — specialized expertise\n\n**Relationship:** The Platform Team builds the IDP that Stream-Aligned Teams consume. Reduces cognitive load and dependencies.'
    },
    {
      front: 'What are Golden Paths and why are they not mandatory?',
      back: '**Golden Paths** = recommended and optimized paths.\n\n**Examples:**\n- Template for new microservice\n- Standard CI/CD pipeline\n- Pre-defined deploy configuration\n- Automatic observability setup\n\n**Why not mandatory:**\n- Devs should have autonomy\n- Forcing causes resistance\n- Special cases may need different approaches\n- The goal is to make them SO good that everyone WANTS to use them'
    },
    {
      front: 'Which metrics measure IDP success?',
      back: '**DORA Metrics:**\n- Deploy Frequency\n- Lead Time for Changes\n- Mean Time to Recovery (MTTR)\n- Change Failure Rate\n\n**Developer Experience:**\n- Developer NPS/Satisfaction\n- Time to onboard (new dev productive)\n- Time to first deploy\n- % of teams using golden paths\n\n**Platform Health:**\n- Platform uptime\n- Infrastructure tickets (should decrease)\n- Self-service adoption rate'
    },
    {
      front: 'What is the difference between Platform Engineering and DevOps?',
      back: '**DevOps:**\n- Culture and practices\n- Each team manages its own infra\n- "You build it, you run it"\n- Can cause high cognitive load\n\n**Platform Engineering:**\n- Internal product (platform)\n- Dedicated team (Platform Team)\n- Abstracts complexity for devs\n- Self-service and golden paths\n- "You build it, we make it easy to run"\n\n**Relationship:** Platform Eng is a natural evolution when DevOps scales to many teams.'
    },
    {
      front: 'What is the "Platform as Product" principle?',
      back: '**Treat the platform as an internal product:**\n\n- **Users:** developers (not ops)\n- **Product Owner:** platform team lead\n- **Roadmap:** based on dev feedback\n- **Metrics:** satisfaction, adoption, impact\n- **Marketing:** docs, demos, onboarding\n- **Iteration:** continuous improvement\n\n**Anti-pattern:** building a platform based solely on the infra team\'s vision without listening to users.'
    },
    {
      front: 'Which tools compose the Platform Engineering ecosystem?',
      back: '| Layer | Tools |\n|-------|-------|\n| **Portal** | Backstage, Port, Cortex |\n| **Templates** | Scaffolder, Cookiecutter |\n| **GitOps** | ArgoCD, Flux, Kargo |\n| **Platform API** | Crossplane, Kratix |\n| **Infra** | Terraform, Pulumi |\n| **Observability** | Prometheus, Grafana |\n| **Security** | Vault, OPA, cert-manager |\n| **CI/CD** | GitHub Actions, Tekton |'
    }
  ],
  lab: null,
  troubleshooting: [
    {
      title: 'Low platform adoption by developers',
      difficulty: 'medium',
      symptom: 'The platform was built but developers continue using workarounds, tickets, and manual processes instead of self-service.',
      diagnosis: `\`\`\`bash
# This is not a technical problem — it is a product problem
# Diagnose via metrics and feedback:
# 1. Measure self-service usage rate vs manual tickets
# 2. Collect developer NPS
# 3. Analyze where devs "abandon" the golden path
# 4. Interview teams that are NOT using the platform
\`\`\``,
      solution: `**Causes and solutions:**

1. **Platform doesn't solve real pain points:** Align roadmap with developers' biggest pain points. Ask: "What takes the most time in your day?"

2. **Poor UX:** If self-service is more complex than a ticket, nobody will use it. Simplify the experience.

3. **Insufficient documentation:** Devs don't know the platform exists or how to use it. Invest in onboarding and docs.

4. **Lack of trust:** If the platform breaks frequently, devs create workarounds. Invest in reliability.

5. **Force vs attract:** Don't force adoption — make the platform so good that devs WANT to use it.`
    },
    {
      title: 'Platform Team overloaded with support',
      difficulty: 'hard',
      symptom: 'The Platform Team spends more time answering questions and solving user problems than building new platform features.',
      diagnosis: `\`\`\`bash
# Analyze:
# 1. Volume and type of tickets/questions received
# 2. Frequency of repeated questions
# 3. Time spent on support vs development
# 4. Most common support topics
\`\`\``,
      solution: `**Actions to resolve:**

1. **Proactive documentation:** For every frequent question, create a doc/tutorial. If the same question appears 3x, automate it.

2. **Enabling Team:** If possible, have an enablement team that handles onboarding and L1 support.

3. **Community of Practice:** Create a channel where devs help devs (Slack, Teams). Platform team moderates but doesn't answer everything.

4. **Better self-service:** If devs need help using self-service, the self-service is too complex. Simplify.

5. **Office hours:** Schedule fixed hours for support instead of handling on-demand requests all day.`
    }
  ]
};
