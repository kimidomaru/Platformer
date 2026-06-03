window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-secure-arch/data-protection'] = {
  theory: `# Data Protection & Encryption

## Relevancia no Exame
> **Design Secure Architectures** vale **30%** do SAA-C03. Criptografia (at-rest/in-transit), gerenciamento de chaves e secrets sao temas frequentes.

## AWS KMS (Key Management Service)

Servico central para criar e gerenciar **chaves de criptografia** em toda a AWS.

### Tipos de Chaves

| Tipo | Gerenciamento | Uso |
|------|--------------|-----|
| **AWS Owned Keys** | AWS gerencia totalmente | Criptografia padrao (S3, EBS) |
| **AWS Managed Keys** (aws/service) | AWS gerencia, visivel no KMS | Padrao por servico (aws/s3, aws/ebs) |
| **Customer Managed Keys (CMK)** | Voce cria e controla | Controle total: rotacao, policies, grants |

### Key Policies e Grants
- **Key Policy**: policy baseada em recurso (obrigatoria, toda chave tem uma)
- **Grants**: delegacao temporaria e programatica sem alterar a key policy
- **ViaService condition**: restringe uso da chave a servicos AWS especificos

### Envelope Encryption
KMS encripta data keys, data keys encriptam os dados. Para objetos > 4 KB, o SDK usa envelope encryption automaticamente via API GenerateDataKey.

### Rotacao de Chaves
- **AWS Managed**: rotacao automatica anual (obrigatoria)
- **Customer Managed**: rotacao automatica opcional (anual), ou rotacao manual
- Material antigo preservado para decriptar dados antigos

### Multi-Region Keys
- Replique chaves entre Regions com mesmo material mas ARN diferente
- Caso de uso: S3 cross-Region replication, DynamoDB global tables, DR

## AWS CloudHSM

**Hardware security module dedicado** — validado FIPS 140-2 Level 3.

| Aspecto | KMS | CloudHSM |
|---------|-----|----------|
| **Tenancy** | Multi-tenant (compartilhado) | Single-tenant (dedicado) |
| **Compliance** | FIPS 140-2 Level 2 | FIPS 140-2 Level 3 |
| **Acesso a chaves** | AWS acessa metadados | AWS NAO tem acesso |
| **Integracao** | Nativa com servicos AWS | Apps custom, Oracle TDE, SSL offloading |
| **HA** | Gerenciado pela AWS | Voce deploya em 2+ AZs |

## AWS Certificate Manager (ACM)

- **Certificados publicos**: gratuitos, auto-renovacao para servicos integrados (ALB, CloudFront, API Gateway)
- **CA Privada**: crie PKI interna (\\$400/mes por CA)
- Certificados ACM NAO podem ser usados diretamente no EC2 — use via ALB/NLB/CloudFront

## Secrets Manager vs Parameter Store

| Feature | Secrets Manager | SSM Parameter Store |
|---------|----------------|---------------------|
| **Auto-rotacao** | Nativa (Lambda) | Sem rotacao nativa |
| **Integracao RDS** | Auto-rotacao nativa | Manual |
| **Custo** | \\$0.40/secret/mes | Gratis (Standard) / \\$0.05 (Advanced) |
| **Limite** | 64 KB | 4 KB (Standard) / 8 KB (Advanced) |
| **Cross-account** | Via resource policy | Sem cross-account nativo |

## Padroes de Criptografia

### Criptografia At-Rest

| Servico | Opcoes |
|---------|--------|
| **S3** | SSE-S3 (AES-256, padrao), SSE-KMS (audit trail), SSE-C (voce fornece chave), DSSE-KMS (dupla criptografia) |
| **EBS** | AES-256 via KMS. Habilite criptografia padrao por Region. Snapshots encriptados permanecem encriptados. |
| **RDS** | Criptografia KMS somente na criacao (nao pode habilitar depois). Read replicas herdam criptografia. |
| **DynamoDB** | AWS owned key (padrao) ou Customer Managed Key |

### Criptografia In-Transit
- **TLS/SSL**: aplicado via endpoints HTTPS
- **CloudFront**: viewer protocol policy (HTTPS only, redirecionar HTTP para HTTPS)
- **RDS**: force SSL via parameter group (rds.force_ssl=1)

## Erros Comuns

- Achar que chaves KMS podem ser compartilhadas entre Regions sem multi-Region keys
- Confundir Secrets Manager (rotacao) com Parameter Store (config)
- Esquecer que certificados ACM nao funcionam diretamente no EC2
- Nao saber que SSE-KMS fornece audit trail via CloudTrail (SSE-S3 nao)
`,

  quiz: [
    {
      question: 'Qual opcao de criptografia S3 fornece trilha de auditoria via CloudTrail?',
      options: ['SSE-S3', 'SSE-KMS', 'SSE-C', 'Criptografia client-side'],
      correct: 1,
      explanation: 'SSE-KMS registra cada uso da chave no CloudTrail. SSE-S3 usa chaves gerenciadas pela Amazon sem log individual por chave.',
      reference: 'SSE-KMS = trilha de auditoria. SSE-S3 = mais simples mas sem audit por chave.'
    },
    {
      question: 'Qual a diferenca principal entre KMS e CloudHSM?',
      options: ['KMS e gratis, CloudHSM e pago', 'KMS e multi-tenant, CloudHSM e single-tenant com hardware dedicado', 'CloudHSM so funciona com S3', 'KMS requer rotacao manual'],
      correct: 1,
      explanation: 'KMS e multi-tenant (FIPS 140-2 Level 2). CloudHSM fornece HSMs single-tenant dedicados (FIPS 140-2 Level 3) onde a AWS NAO tem acesso as suas chaves.',
      reference: 'CloudHSM para: FIPS Level 3, crypto customizado, Oracle TDE, SSL offloading.'
    },
    {
      question: 'Qual servico fornece rotacao automatica de senhas RDS?',
      options: ['AWS KMS', 'SSM Parameter Store', 'AWS Secrets Manager', 'AWS Config'],
      correct: 2,
      explanation: 'Secrets Manager tem integracao nativa com RDS para rotacao automatica de senhas via Lambda. Parameter Store nao tem rotacao nativa.',
      reference: 'Secrets Manager = rotacao. Parameter Store = armazenamento de config (sem rotacao).'
    },
    {
      question: 'Certificados publicos do ACM podem ser usados diretamente no EC2?',
      options: ['Sim, instale via SSM', 'Sim, baixe do ACM', 'Nao, so funcionam com servicos integrados como ALB e CloudFront', 'Sim, com integracao CloudHSM'],
      correct: 2,
      explanation: 'Certificados publicos do ACM nao podem ser exportados. Funcionam apenas com ALB, NLB, CloudFront, API Gateway. Para EC2, use CA terceira ou ACM Private CA.',
      reference: 'Certs publicos ACM: ALB, NLB, CloudFront, API GW apenas. NAO EC2.'
    },
    {
      question: 'O que e envelope encryption no KMS?',
      options: ['Criptografar a key policy', 'Usar KMS para criptografar uma data key que entao criptografa os dados', 'Dupla criptografia com duas chaves KMS', 'Criptografar bucket policies do S3'],
      correct: 1,
      explanation: 'Envelope encryption: KMS encripta uma data key (pequena). A data key encripta os dados (grandes). Evita enviar dados grandes ao KMS (limite 4 KB na API).',
      reference: 'API GenerateDataKey retorna data key em texto plano + encriptada.'
    },
    {
      question: 'Como funcionam as multi-Region keys do KMS?',
      options: ['A mesma chave esta disponivel automaticamente em todos os lugares', 'Voce replica a chave para outras Regions com mesmo material mas ARN diferente', 'Chaves sao compartilhadas via S3 cross-Region replication', 'Multi-Region e apenas para CloudHSM'],
      correct: 1,
      explanation: 'Multi-Region keys compartilham o mesmo material mas tem ARNs diferentes por Region. Encripte em uma Region, decripte em outra sem re-criptografia.',
      reference: 'Mesmo material, ARN diferente. Para: S3 cross-Region replication, DynamoDB global tables.'
    },
    {
      question: 'O que acontece ao habilitar criptografia padrao de EBS para uma Region?',
      options: ['Volumes existentes sao encriptados', 'Apenas novos volumes e snapshots EBS sao encriptados automaticamente', 'Todas as instancias EC2 sao encriptadas', 'Habilita criptografia S3 tambem'],
      correct: 1,
      explanation: 'Criptografia padrao de EBS aplica-se a NOVOS volumes e snapshots naquela Region. Volumes nao encriptados existentes nao sao afetados.',
      reference: 'Criptografia padrao e por Region. Volumes existentes precisam de copia para encriptar.'
    },
    {
      question: 'Qual tier do SSM Parameter Store suporta parametros ate 8 KB?',
      options: ['Standard (gratis)', 'Advanced (pago)', 'Premium', 'Enterprise'],
      correct: 1,
      explanation: 'Standard: ate 4 KB, gratis, 10.000 parametros. Advanced: ate 8 KB, \\$0.05/param/mes, parameter policies e throughput maior.',
      reference: 'Standard: 4 KB, gratis. Advanced: 8 KB, \\$0.05/mes, parameter policies.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 3 tipos de chaves KMS?', back: 'AWS Owned Keys (totalmente gerenciadas, invisiveis). AWS Managed Keys (aws/service, visiveis, rotacao automatica). Customer Managed Keys (voce cria, controle total, rotacao opcional).' },
    { front: 'O que e envelope encryption?', back: 'KMS encripta uma data key (GenerateDataKey). A data key encripta os dados reais. Evita enviar dados grandes ao KMS (limite 4 KB). SDK faz automaticamente.' },
    { front: 'KMS vs CloudHSM?', back: 'KMS: multi-tenant, FIPS 140-2 Level 2, gerenciado pela AWS. CloudHSM: single-tenant dedicado, FIPS 140-2 Level 3, VOCE gerencia chaves, AWS sem acesso.' },
    { front: 'Secrets Manager vs Parameter Store?', back: 'Secrets Manager: auto-rotacao (Lambda), integracao RDS, \\$0.40/secret/mes, cross-account. Parameter Store: config+secrets, sem rotacao, gratis (Standard 4KB) ou \\$0.05 (Advanced 8KB).' },
    { front: 'Opcoes de criptografia server-side do S3?', back: 'SSE-S3 (AES-256, padrao), SSE-KMS (chave KMS, audit CloudTrail), SSE-C (chave fornecida pelo cliente), DSSE-KMS (dupla criptografia). Client-side tambem e possivel.' },
    { front: 'Certificados ACM podem ser usados no EC2?', back: 'Nao. Certs publicos do ACM nao podem ser exportados. Use com ALB, NLB, CloudFront, API Gateway apenas. Para EC2, use CA terceira ou ACM Private CA (\\$400/mes).' },
    { front: 'O que sao KMS multi-Region keys?', back: 'Chaves com mesmo material criptografico replicado entre Regions (ARNs diferentes). Encripte em uma Region, decripte em outra. Para: S3 cross-Region replication, DynamoDB global tables, DR.' },
    { front: 'Como forcar criptografia in-transit no RDS?', back: 'Defina rds.force_ssl=1 no DB parameter group. Obriga todas as conexoes a usar SSL/TLS. Baixe o CA bundle do RDS para verificacao no cliente.' }
  ],

  lab: {
    scenario: 'Configure criptografia at-rest e gerencie secrets para uma arquitetura de aplicacao.',
    objective: 'Praticar gerenciamento de chaves KMS, criptografia S3 e rotacao com Secrets Manager.',
    duration: '20-30 minutos',
    steps: [
      {
        title: 'Criar e Usar uma Customer Managed Key',
        instruction: 'Crie uma CMK no KMS, adicione um alias e configure-a como criptografia padrao para um bucket S3.',
        hints: ['aws kms create-key retorna KeyId', 'Use --server-side-encryption aws:kms no S3'],
        solution: '```bash\n# Criar CMK\naws kms create-key --description "Minha chave S3" \\\n  --key-usage ENCRYPT_DECRYPT --origin AWS_KMS\n\n# Criar alias\naws kms create-alias --alias-name alias/my-s3-key \\\n  --target-key-id <key-id>\n\n# Definir criptografia padrao do bucket\naws s3api put-bucket-encryption --bucket my-bucket \\\n  --server-side-encryption-configuration \\\n  \'{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"alias/my-s3-key"},"BucketKeyEnabled":true}]}\'\n```',
        verify: '```bash\naws kms describe-key --key-id alias/my-s3-key\n# Esperado: KeyState = Enabled\n\naws s3api get-bucket-encryption --bucket my-bucket\n# Esperado: SSEAlgorithm = aws:kms\n```'
      },
      {
        title: 'Armazenar e Rotacionar um Secret',
        instruction: 'Crie uma credencial de banco no Secrets Manager e configure rotacao automatica a cada 30 dias.',
        hints: ['Secrets Manager tem APIs create-secret e rotate-secret', 'Rotacao precisa de um ARN de funcao Lambda'],
        solution: '```bash\n# Criar secret\naws secretsmanager create-secret \\\n  --name prod/db/credentials \\\n  --secret-string \'{"username":"admin","password":"MyP@ss123"}\'\n\n# Habilitar rotacao\naws secretsmanager rotate-secret \\\n  --secret-id prod/db/credentials \\\n  --rotation-lambda-arn arn:aws:lambda:REGION:ACCT:function:SecretsRotation \\\n  --rotation-rules AutomaticallyAfterDays=30\n```',
        verify: '```bash\naws secretsmanager describe-secret --secret-id prod/db/credentials\n# Esperado: RotationEnabled = true\n# RotationRules.AutomaticallyAfterDays = 30\n```'
      },
      {
        title: 'Comparar SSE-S3 vs SSE-KMS',
        instruction: 'Faca upload de um objeto com SSE-S3 e outro com SSE-KMS. Compare os metadados de criptografia.',
        hints: ['--server-side-encryption AES256 para SSE-S3', '--server-side-encryption aws:kms para SSE-KMS'],
        solution: '```bash\n# Upload com SSE-S3\naws s3api put-object --bucket my-bucket --key test-s3.txt \\\n  --body file.txt --server-side-encryption AES256\n\n# Upload com SSE-KMS\naws s3api put-object --bucket my-bucket --key test-kms.txt \\\n  --body file.txt --server-side-encryption aws:kms \\\n  --ssekms-key-id alias/my-s3-key\n```',
        verify: '```bash\naws s3api head-object --bucket my-bucket --key test-s3.txt\n# Esperado: ServerSideEncryption = AES256\n\naws s3api head-object --bucket my-bucket --key test-kms.txt\n# Esperado: ServerSideEncryption = aws:kms\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Conflito entre Key Policy e IAM Policy no KMS',
      difficulty: 'hard',
      symptom: 'Usuario tem permissoes IAM para kms:Encrypt mas recebe Access Denied.',
      diagnosis: '```\nKMS usa autorizacao dual:\n\n1. Key policy DEVE permitir o root principal da conta\n   Se nao tiver, IAM policies sao completamente IGNORADAS\n\n2. Key policy padrao permite o root principal\n   Entao IAM policies podem conceder permissoes KMS\n\n3. Se key policy lista apenas principals especificos\n   Apenas esses principals podem usar a chave\n\nVerifique:\n  aws kms get-key-policy --key-id KEY --policy-name default\n  Procure: Principal: {"AWS": "arn:aws:iam::ACCOUNT:root"}\n```',
      solution: 'A key policy DEVE permitir o root principal da conta para que IAM policies tenham efeito. Se a key policy lista apenas usuarios/roles especificos, somente eles acessam independente das permissoes IAM.'
    },
    {
      title: 'Nao Consigo Criptografar Volume EBS Existente',
      difficulty: 'medium',
      symptom: 'Preciso criptografar um volume EBS nao encriptado existente mas nao ha opcao in-place.',
      diagnosis: '```\nCriptografia EBS nao pode ser alterada in-place:\n\n1. Crie snapshot do volume nao encriptado\n2. Copie snapshot COM criptografia habilitada\n3. Crie novo volume do snapshot encriptado\n4. Pare instancia e troque os volumes\n\nComandos:\n  aws ec2 create-snapshot --volume-id vol-xxx\n  aws ec2 copy-snapshot --source-snapshot-id snap-xxx \\\n    --encrypted --kms-key-id alias/my-key\n  aws ec2 create-volume --snapshot-id snap-encrypted \\\n    --availability-zone us-east-1a\n```',
      solution: 'Crie snapshot > copie com criptografia > crie novo volume encriptado > troque na instancia. Habilite criptografia padrao de EBS por Region para prevenir volumes nao encriptados no futuro.'
    }
  ]
};
