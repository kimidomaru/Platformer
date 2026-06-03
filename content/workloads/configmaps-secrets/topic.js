window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['workloads/configmaps-secrets'] = {
  theory: `# ConfigMaps e Secrets

## O que sao ConfigMaps?

ConfigMaps sao objetos do Kubernetes usados para armazenar dados de configuracao **nao-sensiveis** em pares chave-valor. Eles permitem desacoplar configuracoes especificas do ambiente das imagens de container, possibilitando a mesma imagem em diferentes ambientes (dev, staging, producao) com configuracoes distintas.

### Pontos importantes sobre ConfigMaps

- **Atualizacao em volumes**: quando um ConfigMap montado como volume e atualizado, os arquivos sao atualizados automaticamente (com delay de ~1-2 minutos). Porem, **variaveis de ambiente NAO sao atualizadas** — o Pod precisa ser reiniciado.
- **Multiplos ConfigMaps**: e possivel usar multiplos ConfigMaps para um unico Pod, separando diferentes aspectos da configuracao.
- **Imutabilidade**: desde K8s 1.19 (GA 1.21), ConfigMaps podem ser marcados como imutaveis para melhor performance e seguranca.
- **Tamanho maximo**: 1 MiB por ConfigMap (incluindo todas as chaves e valores).

---

## Criando ConfigMaps

### A partir de literais (--from-literal)

\`\`\`bash
kubectl create configmap app-config \\
  --from-literal=ENV=production \\
  --from-literal=LOG_LEVEL=info \\
  --from-literal=MAX_CONNECTIONS=100
\`\`\`

### A partir de arquivo (--from-file)

\`\`\`bash
# O nome do arquivo vira a chave, o conteudo vira o valor
kubectl create configmap app-config --from-file=app.properties

# Especificar uma chave customizada para o arquivo
kubectl create configmap app-config --from-file=config-key=app.properties

# A partir de um diretorio inteiro (cada arquivo = uma chave)
kubectl create configmap app-config --from-file=./config-dir/
\`\`\`

### A partir de variavel de ambiente (--from-env-file)

\`\`\`bash
# Arquivo .env com formato KEY=VALUE por linha
kubectl create configmap app-config --from-env-file=.env
\`\`\`

### Via manifesto YAML

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  # Pares chave-valor simples
  ENV: "production"
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"
  # Arquivo completo como valor (usando | para bloco multi-linha)
  app.properties: |
    server.port=8080
    spring.profiles.active=prod
  # Arquivo de configuracao do Nginx
  nginx.conf: |
    events { }
    http {
      server {
        listen 80;
        location / {
          return 200 'OK';
        }
      }
    }
\`\`\`

O caractere \`|\` permite definir o valor como bloco de texto multi-linha, ideal para arquivos de configuracao inteiros.

---

## Usando ConfigMaps em Pods

### Como variaveis de ambiente (envFrom — todas as chaves)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    envFrom:
    - configMapRef:
        name: app-config
      prefix: APP_  # Opcional: prefixo nas variaveis (APP_ENV, APP_LOG_LEVEL...)
\`\`\`

### Como variavel de ambiente especifica (env.valueFrom — uma chave)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    env:
    - name: NIVEL_LOG          # Nome da variavel no container
      valueFrom:
        configMapKeyRef:
          name: app-config     # Nome do ConfigMap
          key: LOG_LEVEL       # Chave no ConfigMap
          optional: true       # Nao falhar se o CM nao existir
\`\`\`

### Como volume (montagem de arquivos)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  volumes:
  - name: config-volume
    configMap:
      name: app-config
      items:                # Opcional: montar apenas chaves especificas
      - key: nginx.conf
        path: nginx.conf    # Nome do arquivo no volume
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: config-volume
      mountPath: /etc/config
      readOnly: true
\`\`\`

Cada chave do ConfigMap vira um arquivo em /etc/config/. Com \`items\`, voce seleciona quais chaves montar.

### Montando um unico arquivo com subPath

\`\`\`yaml
    volumeMounts:
    - name: config-volume
      mountPath: /etc/nginx/nginx.conf  # Caminho exato do arquivo
      subPath: nginx.conf               # Chave do ConfigMap
\`\`\`

**Importante:** Com \`subPath\`, o arquivo NAO e atualizado automaticamente quando o ConfigMap muda.

---

## O que sao Secrets?

Secrets sao semelhantes aos ConfigMaps, porem destinados a dados **sensiveis** como senhas, tokens e chaves TLS. Os valores sao codificados em **base64** (nao criptografados por padrao).

### Base64 NAO e criptografia!

Base64 e um esquema de **codificacao**, nao de criptografia. Qualquer pessoa com acesso ao Secret pode decodificar os dados:

\`\`\`bash
# Codificar
echo -n 'minha-senha' | base64          # bWluaGEtc2VuaGE=

# Decodificar (qualquer um pode fazer!)
echo -n 'bWluaGEtc2VuaGE=' | base64 -d  # minha-senha
\`\`\`

**Use -n no echo** para nao adicionar newline, o que alteraria o valor codificado.

Para seguranca real, habilite **encryption at rest** no etcd e controle acesso com RBAC.

### Tipos de Secrets

| Tipo | Descricao | Criacao via kubectl |
|------|-----------|-------------------|
| **Opaque** | Dados arbitrarios (padrao) | \`kubectl create secret generic\` |
| **kubernetes.io/service-account-token** | Token de service account | Automatico |
| **kubernetes.io/dockerconfigjson** | Credenciais de registry Docker | \`kubectl create secret docker-registry\` |
| **kubernetes.io/tls** | Certificado TLS e chave privada | \`kubectl create secret tls\` |
| **kubernetes.io/basic-auth** | Credenciais de autenticacao basica | Via YAML |
| **kubernetes.io/ssh-auth** | Credenciais SSH | Via YAML |
| **bootstrap.kubernetes.io/token** | Token de inicializacao do cluster | Via YAML |

Cada tipo tem formato especifico de dados. O tipo define quais campos sao esperados.

---

## Criando Secrets

### Secret Opaque via kubectl

\`\`\`bash
# Usando --from-literal (codifica em base64 automaticamente)
kubectl create secret generic db-credentials \\
  --from-literal=username=admin \\
  --from-literal=password=S3cr3t!

# Usando --from-file
kubectl create secret generic ssh-key --from-file=ssh-privatekey=/path/to/.ssh/id_rsa

# Usando --from-env-file
kubectl create secret generic app-secrets --from-env-file=.env.secret
\`\`\`

### Secret via YAML com data (base64)

\`\`\`bash
# Codificar valores manualmente
echo -n 'admin' | base64       # YWRtaW4=
echo -n 'S3cr3t!' | base64    # UzNjcjN0IQ==
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:                    # Valores em base64
  username: YWRtaW4=
  password: UzNjcjN0IQ==
\`\`\`

### Secret via YAML com stringData (texto puro)

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:              # Valores em TEXTO PURO (codificados ao criar)
  username: admin
  password: S3cr3t!
\`\`\`

**stringData** e conveniente: voce escreve em texto puro e o Kubernetes codifica automaticamente em base64 ao criar o Secret. No \`kubectl get -o yaml\`, os valores aparecem no campo \`data\` em base64.

### Secret Docker Registry

\`\`\`bash
kubectl create secret docker-registry regcred \\
  --docker-server=registry.example.com \\
  --docker-username=myuser \\
  --docker-password=mypassword \\
  --docker-email=myuser@example.com
\`\`\`

Para usar imagens privadas, referendie o Secret no Pod:

\`\`\`yaml
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: app
    image: registry.example.com/minha-imagem-privada:latest
\`\`\`

### Secret TLS

\`\`\`bash
# Primeiro, gerar certificado auto-assinado (para testes)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
  -keyout chave-privada.key -out certificado.crt

# Criar o Secret TLS
kubectl create secret tls meu-tls-secret \\
  --cert=certificado.crt \\
  --key=chave-privada.key
\`\`\`

As chaves no Secret serao \`tls.crt\` e \`tls.key\`. Muito usado com Ingress para HTTPS.

---

## Usando Secrets em Pods

### Como variaveis de ambiente (por chave)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: db-pod
spec:
  containers:
  - name: app
    image: postgres:15
    env:
    - name: POSTGRES_USER
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: username
    - name: POSTGRES_PASSWORD
      valueFrom:
        secretKeyRef:
          name: db-credentials
          key: password
\`\`\`

### Como variaveis de ambiente (todas as chaves)

\`\`\`yaml
spec:
  containers:
  - name: app
    image: nginx:1.25
    envFrom:
    - secretRef:
        name: db-credentials
\`\`\`

### Como volume (arquivos montados)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  volumes:
  - name: secret-volume
    secret:
      secretName: db-credentials
      defaultMode: 0400          # Permissao segura: somente leitura pelo owner
      items:                     # Opcional: selecionar chaves especificas
      - key: tls.crt
        path: certificado.crt   # Nome do arquivo montado
      - key: tls.key
        path: chave-privada.key
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: secret-volume
      mountPath: /etc/secrets
      readOnly: true
\`\`\`

**Pratica recomendada:** Use \`defaultMode: 0400\` para Secrets como volume (somente leitura pelo owner). O padrao e 0644, que permite leitura por todos.

---

## Exemplo Pratico: Nginx com HTTPS usando ConfigMap + Secret

### 1. Criar Secret TLS

\`\`\`bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
  -keyout chave.key -out cert.crt -subj "/CN=meu-nginx"
kubectl create secret tls nginx-tls --cert=cert.crt --key=chave.key
\`\`\`

### 2. Criar ConfigMap com configuracao do Nginx

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-config
data:
  nginx.conf: |
    events { }
    http {
      server {
        listen 80;
        listen 443 ssl;
        ssl_certificate /etc/nginx/tls/tls.crt;
        ssl_certificate_key /etc/nginx/tls/tls.key;
        location / {
          return 200 'HTTPS funcionando!';
          add_header Content-Type text/plain;
        }
      }
    }
\`\`\`

### 3. Pod usando ambos

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-https
spec:
  containers:
  - name: nginx
    image: nginx
    ports:
    - containerPort: 80
    - containerPort: 443
    volumeMounts:
    - name: nginx-config
      mountPath: /etc/nginx/nginx.conf
      subPath: nginx.conf
    - name: nginx-tls
      mountPath: /etc/nginx/tls
  volumes:
  - name: nginx-config
    configMap:
      name: nginx-config
  - name: nginx-tls
    secret:
      secretName: nginx-tls
\`\`\`

---

## ConfigMaps e Secrets Imutaveis

A partir do Kubernetes 1.19 (GA 1.21), e possivel marcar ConfigMaps e Secrets como imutaveis.

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-v1
immutable: true          # Torna o ConfigMap imutavel
data:
  ENV: "production"
\`\`\`

**Beneficios:**
- **Performance**: kubelet nao precisa fazer watch de mudancas (importante com muitos ConfigMaps/Secrets)
- **Seguranca**: protege contra alteracoes acidentais
- Para alterar, e necessario **deletar e recriar** o objeto

---

## Decodificando e Inspecionando Secrets

\`\`\`bash
# Ver secret com valores em base64
kubectl get secret db-credentials -o yaml

# Decodificar um campo especifico
kubectl get secret db-credentials -o jsonpath='{.data.password}' | base64 --decode

# Ver todos os dados decodificados
kubectl get secret db-credentials -o go-template='{{range $k,$v := .data}}{{$k}}={{$v|base64decode}}{{"\\n"}}{{end}}'

# Listar todos os Secrets
kubectl get secrets

# Ver detalhes (mostra tamanho dos campos, sem revelar valores)
kubectl describe secret db-credentials
\`\`\`

---

## Boas Praticas

| Pratica | Motivo |
|---------|--------|
| **Nunca versionar Secrets em Git** | Dados sensiveis ficariam expostos. Use Sealed Secrets, Vault ou External Secrets Operator |
| **Habilitar encryption at rest** | Base64 nao e criptografia. Configure EncryptionConfiguration no etcd |
| **Usar RBAC** | Restringir quem pode ler Secrets (get, list, watch) |
| **Preferir volumes a env vars** | Variaveis de ambiente aparecem em logs, dumps e \`/proc/1/environ\`. Volumes sao mais seguros |
| **Usar immutable: true** | Melhor performance e protecao contra mudancas acidentais |
| **Nomear com versao** | \`config-v1\`, \`config-v2\` facilita rollback e rastreamento |
| **Usar stringData no YAML** | Mais legivel que codificar manualmente em base64 |
| **defaultMode: 0400** | Para Secrets como volume, restringir permissoes dos arquivos |
`,

  quiz: [
    {
      question: 'Qual comando cria um ConfigMap chamado "app-config" com a chave ENV=production a partir de um literal?',
      options: [
        'kubectl create configmap app-config --from-env ENV=production',
        'kubectl create configmap app-config --from-literal=ENV=production',
        'kubectl apply configmap app-config --literal ENV=production',
        'kubectl create cm app-config --key=ENV --value=production'
      ],
      correct: 1,
      explanation: 'O flag --from-literal=CHAVE=VALOR cria ConfigMaps a partir de pares chave-valor na linha de comando. Multiplos pares podem ser especificados repetindo o flag. Outras opcoes: --from-file e --from-env-file.'
    },
    {
      question: 'Qual e o tipo padrao de um Secret criado com "kubectl create secret generic"?',
      options: [
        'kubernetes.io/dockerconfigjson',
        'kubernetes.io/tls',
        'Opaque',
        'kubernetes.io/service-account-token'
      ],
      correct: 2,
      explanation: 'O tipo "Opaque" e o padrao para Secrets criados com "kubectl create secret generic". Aceita dados arbitrarios em pares chave-valor codificados em base64. Outros tipos especializados: tls, dockerconfigjson, basic-auth, ssh-auth.'
    },
    {
      question: 'Como os valores de um Secret sao armazenados no objeto Kubernetes?',
      options: [
        'Em texto puro sem nenhuma transformacao',
        'Criptografados com AES-256 por padrao',
        'Codificados em base64',
        'Comprimidos com gzip e depois codificados em base64'
      ],
      correct: 2,
      explanation: 'Valores de Secrets sao codificados em base64, que e CODIFICACAO, nao criptografia. Qualquer um com acesso pode decodificar com "base64 -d". Para seguranca real, habilite encryption at rest no etcd e controle acesso com RBAC.'
    },
    {
      question: 'Qual e a vantagem de marcar um ConfigMap como "immutable: true"?',
      options: [
        'O ConfigMap passa a ser criptografado automaticamente',
        'O kubelet nao precisa monitorar mudancas, melhorando a performance, e protege contra alteracoes acidentais',
        'O ConfigMap pode ser compartilhado entre namespaces diferentes',
        'Os dados sao replicados para todos os nodes automaticamente'
      ],
      correct: 1,
      explanation: 'ConfigMaps/Secrets imutaveis melhoram performance (kubelet nao faz watch) e protegem contra alteracoes acidentais. Disponivel desde K8s 1.19 (GA 1.21). Para modificar, e necessario deletar e recriar o objeto.'
    },
    {
      question: 'Qual campo YAML e usado para referenciar todas as chaves de um ConfigMap como variaveis de ambiente em um container?',
      options: [
        'env.configMapRef',
        'envFrom com configMapRef',
        'environment.fromConfigMap',
        'vars.configMapSource'
      ],
      correct: 1,
      explanation: '"envFrom" com "configMapRef" injeta TODAS as chaves do ConfigMap como variaveis de ambiente. Para uma chave especifica, use "env" com "valueFrom.configMapKeyRef", que tambem permite renomear a variavel.'
    },
    {
      question: 'Como criar um Secret do tipo TLS usando kubectl?',
      options: [
        'kubectl create secret tls meu-tls --cert=tls.crt --key=tls.key',
        'kubectl create secret generic meu-tls --from-file=tls.crt --from-file=tls.key',
        'kubectl create secret tls meu-tls --certificate=tls.crt --private-key=tls.key',
        'kubectl apply -f tls-secret.yaml --type=tls'
      ],
      correct: 0,
      explanation: '"kubectl create secret tls" cria tipo kubernetes.io/tls usando --cert e --key. As chaves no Secret serao "tls.crt" e "tls.key" independente dos nomes dos arquivos originais. Muito usado com Ingress para HTTPS.'
    },
    {
      question: 'Ao montar um Secret como volume, qual permissao padrao e aplicada aos arquivos criados?',
      options: [
        '0777 (rwxrwxrwx)',
        '0644 (rw-r--r--)',
        '0600 (rw-------)',
        '0755 (rwxr-xr-x)'
      ],
      correct: 1,
      explanation: 'O padrao e 0644, que permite leitura por todos os usuarios do container. Para Secrets sensiveis, use "defaultMode: 0400" (somente leitura pelo proprietario). Configure no spec.volumes[].secret.defaultMode.'
    },
    {
      question: 'Qual e a diferenca entre os campos "data" e "stringData" em um Secret YAML?',
      options: [
        'Nao ha diferenca, sao sinonimos',
        '"data" aceita valores em base64 e "stringData" aceita valores em texto puro que sao codificados automaticamente',
        '"data" e para strings e "stringData" e para dados binarios',
        '"stringData" e um campo read-only para visualizacao'
      ],
      correct: 1,
      explanation: '"data" requer valores codificados manualmente em base64. "stringData" aceita texto puro — o Kubernetes codifica automaticamente ao criar o Secret. stringData e mais conveniente e legivel. No "kubectl get -o yaml", os valores aparecem no campo "data" em base64.'
    },
    {
      question: 'O que acontece quando um ConfigMap montado como volume e atualizado?',
      options: [
        'O Pod e automaticamente reiniciado',
        'Os arquivos montados via volume sao atualizados automaticamente, mas variaveis de ambiente NAO',
        'Nada acontece, o Pod precisa ser recriado',
        'O ConfigMap nao pode ser atualizado enquanto esta montado'
      ],
      correct: 1,
      explanation: 'Arquivos montados via volume sao atualizados automaticamente com delay de ~1-2 minutos. Porem variaveis de ambiente (envFrom/env) NAO sao atualizadas — o Pod precisa ser reiniciado. EXCECAO: volumes com subPath NAO sao atualizados automaticamente.'
    },
    {
      question: 'Para usar imagens Docker privadas, qual campo do Pod referencia o Secret com credenciais?',
      options: [
        'spec.dockerAuth',
        'spec.imagePullSecrets',
        'spec.containers[].imageAuth',
        'spec.registryCredentials'
      ],
      correct: 1,
      explanation: 'spec.imagePullSecrets referencia Secrets do tipo kubernetes.io/dockerconfigjson. O Secret e criado com "kubectl create secret docker-registry". Cada item lista um Secret: imagePullSecrets: [{name: regcred}].'
    }
  ],

  flashcards: [
    {
      front: 'Qual e a diferenca entre ConfigMap e Secret no Kubernetes?',
      back: 'ConfigMap: dados de configuracao NAO-sensiveis em texto puro.\nSecret: dados SENSIVEIS codificados em base64.\n\nAmbos podem ser usados como env vars ou volumes. Secrets tem RBAC mais restritivo por padrao e podem ser criptografados at rest no etcd.\n\nImportante: base64 NAO e criptografia!'
    },
    {
      front: 'Como decodificar o valor de um Secret usando kubectl?',
      back: 'Campo especifico:\nkubectl get secret <nome> -o jsonpath=\'{.data.<chave>}\' | base64 --decode\n\nTodos os campos:\nkubectl get secret <nome> -o go-template=\'{{range $k,$v := .data}}{{$k}}={{$v|base64decode}}{{\"\\n\"}}{{end}}\'\n\nLembrete: use "echo -n" ao codificar para evitar newline extra.'
    },
    {
      front: 'O que acontece quando um ConfigMap usado como volume e atualizado?',
      back: 'Arquivos montados via volume: ATUALIZADOS automaticamente (delay de ~1-2 min).\n\nVariaveis de ambiente (envFrom/env): NAO atualizadas — Pod precisa ser reiniciado.\n\nVolumes com subPath: NAO atualizados automaticamente.\n\nTambem e possivel usar inotify dentro do container para detectar mudancas.'
    },
    {
      front: 'Quais sao os tipos de Secret mais comuns no Kubernetes?',
      back: '1. Opaque - dados arbitrarios (padrao, criado com "generic")\n2. kubernetes.io/dockerconfigjson - credenciais de registry\n3. kubernetes.io/tls - certificados TLS (chaves: tls.crt, tls.key)\n4. kubernetes.io/basic-auth - usuario/senha\n5. kubernetes.io/ssh-auth - chaves SSH\n6. kubernetes.io/service-account-token - tokens de SA\n7. bootstrap.kubernetes.io/token - tokens de bootstrap'
    },
    {
      front: 'Como usar imagens Docker privadas no Kubernetes?',
      back: '1. Criar Secret:\nkubectl create secret docker-registry regcred \\\n  --docker-server=registry.example.com \\\n  --docker-username=user \\\n  --docker-password=pass\n\n2. No Pod:\nspec:\n  imagePullSecrets:\n  - name: regcred\n  containers:\n  - image: registry.example.com/app:v1\n\nDocker Hub limita 100 pulls/6h para nao-autenticados.'
    },
    {
      front: 'O que significa "immutable: true" em ConfigMaps e Secrets?',
      back: 'Impede alteracoes nos dados apos criacao.\n\nBeneficios:\n1. Performance: kubelet nao faz watch (importante com muitos CMs/Secrets)\n2. Seguranca: protege contra mudancas acidentais\n3. Disponivel desde K8s 1.19 (GA 1.21)\n\nPara alterar: deletar e RECRIAR o objeto.\nErro ao tentar modificar: "configmap is immutable"'
    },
    {
      front: 'Qual e a diferenca entre envFrom e env.valueFrom para ConfigMaps?',
      back: 'envFrom + configMapRef:\n- Injeta TODAS as chaves como env vars\n- Opcional: prefix para adicionar prefixo\n- Nao permite renomear\n\nenv + valueFrom.configMapKeyRef:\n- Injeta UMA chave especifica\n- Permite renomear a variavel\n- Suporta "optional: true" para nao falhar se CM nao existir'
    },
    {
      front: 'Qual a diferenca entre "data" e "stringData" em um Secret YAML?',
      back: 'data: valores devem ser codificados MANUALMENTE em base64.\nstringData: valores em TEXTO PURO, K8s codifica automaticamente.\n\nExemplo:\ndata:\n  password: UzNjcjN0IQ==\n\nstringData:\n  password: S3cr3t!\n\nNo "kubectl get -o yaml", tudo aparece no campo "data" em base64. stringData e write-only.'
    },
    {
      front: 'Como montar um unico arquivo de ConfigMap sem sobrescrever o diretorio?',
      back: 'Use subPath para montar apenas um arquivo:\n\nvolumeMounts:\n- name: config\n  mountPath: /etc/nginx/nginx.conf\n  subPath: nginx.conf\n\nATENCAO: com subPath, o arquivo NAO e atualizado automaticamente quando o ConfigMap muda!\n\nSem subPath, todo o diretorio mountPath e substituido pelo conteudo do ConfigMap.'
    },
    {
      front: 'Quais sao as boas praticas de seguranca para Secrets?',
      back: '1. Nunca versionar Secrets em Git (use Sealed Secrets, Vault)\n2. Habilitar encryption at rest no etcd (EncryptionConfiguration)\n3. RBAC: restringir get/list/watch de Secrets\n4. Preferir volumes a env vars (env vars aparecem em logs/dumps)\n5. defaultMode: 0400 para volumes de Secrets\n6. Usar immutable: true quando possivel\n7. Nomear com versao (secret-v1, secret-v2)'
    },
    {
      front: 'Exemplo pratico: Nginx com HTTPS usando ConfigMap + Secret',
      back: '1. Criar Secret TLS:\nkubectl create secret tls nginx-tls --cert=cert.crt --key=chave.key\n\n2. Criar ConfigMap com nginx.conf\n\n3. Pod com dois volumes:\nvolumes:\n- name: config\n  configMap: {name: nginx-config}\n- name: tls\n  secret: {secretName: nginx-tls}\n\nvolumeMounts:\n- mountPath: /etc/nginx/nginx.conf, subPath: nginx.conf\n- mountPath: /etc/nginx/tls'
    }
  ],

  lab: {
    scenario: 'Uma aplicacao web precisa de configuracoes de ambiente e credenciais de banco de dados. Voce deve criar ConfigMaps e Secrets, injecta-los no Pod de diferentes formas, e verificar o acesso correto dentro do container.',
    objective: 'Criar e utilizar ConfigMaps e Secrets como variaveis de ambiente e volumes, validando o acesso dentro do container',
    steps: [
      {
        title: 'Criar ConfigMap com configuracoes da aplicacao',
        instruction: 'Crie um ConfigMap chamado `app-config` no namespace `default` com as seguintes chaves: `APP_ENV=production`, `LOG_LEVEL=info`, `APP_PORT=8080`. Em seguida, inspecione o objeto criado.',
        hints: [
          'Use kubectl create configmap com o flag --from-literal para cada par chave-valor',
          'Use kubectl describe configmap app-config para verificar os dados',
          'kubectl get cm app-config -o yaml mostra o manifesto completo'
        ],
        solution: '```bash\n# Criar o ConfigMap\nkubectl create configmap app-config \\\n  --from-literal=APP_ENV=production \\\n  --from-literal=LOG_LEVEL=info \\\n  --from-literal=APP_PORT=8080\n\n# Verificar o ConfigMap criado\nkubectl describe configmap app-config\n\n# Ver o manifesto YAML\nkubectl get configmap app-config -o yaml\n```'
      },
      {
        title: 'Criar Secret com credenciais do banco de dados',
        instruction: 'Crie um Secret do tipo Opaque chamado `db-credentials` com as chaves `username=dbadmin` e `password=SuperS3cret!`. Verifique que os valores estao codificados em base64 e decodifique-os para confirmar.',
        hints: [
          'Use kubectl create secret generic para criar um Secret Opaque',
          'Use kubectl get secret db-credentials -o yaml para ver os valores em base64',
          'Para decodificar: kubectl get secret db-credentials -o jsonpath=\'{.data.password}\' | base64 --decode'
        ],
        solution: '```bash\n# Criar o Secret\nkubectl create secret generic db-credentials \\\n  --from-literal=username=dbadmin \\\n  --from-literal=password=SuperS3cret!\n\n# Ver o Secret (valores em base64)\nkubectl get secret db-credentials -o yaml\n\n# Decodificar o username\nkubectl get secret db-credentials \\\n  -o jsonpath=\'{.data.username}\' | base64 --decode\n\n# Decodificar o password\nkubectl get secret db-credentials \\\n  -o jsonpath=\'{.data.password}\' | base64 --decode\n```'
      },
      {
        title: 'Criar Pod usando ConfigMap e Secret',
        instruction: 'Crie um Pod chamado `config-test` usando a imagem `busybox:1.36` que injete o ConfigMap como variaveis de ambiente (envFrom) e o Secret como volume montado em `/etc/secrets`. O container deve executar o comando `sleep 3600`.',
        hints: [
          'Use envFrom com configMapRef para injetar todas as variaveis do ConfigMap',
          'Use spec.volumes com secret.secretName e spec.containers.volumeMounts para montar o Secret',
          'Defina defaultMode: 0400 no volume do Secret para permissao segura'
        ],
        solution: '```bash\n# Criar o manifesto do Pod\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: config-test\nspec:\n  volumes:\n  - name: secret-vol\n    secret:\n      secretName: db-credentials\n      defaultMode: 0400\n  containers:\n  - name: app\n    image: busybox:1.36\n    command: ["sleep", "3600"]\n    envFrom:\n    - configMapRef:\n        name: app-config\n    volumeMounts:\n    - name: secret-vol\n      mountPath: /etc/secrets\n      readOnly: true\nEOF\n\n# Aguardar o Pod ficar Running\nkubectl wait pod config-test --for=condition=Ready --timeout=60s\n\n# Verificar variaveis de ambiente injetadas\nkubectl exec config-test -- env | grep -E "APP_|LOG_"\n\n# Verificar arquivos do Secret no volume\nkubectl exec config-test -- ls /etc/secrets\nkubectl exec config-test -- cat /etc/secrets/username\nkubectl exec config-test -- cat /etc/secrets/password\n```'
      },
      {
        title: 'Tornar ConfigMap imutavel e testar protecao',
        instruction: 'Crie um novo ConfigMap chamado `app-config-v2` como imutavel com os mesmos dados, e tente modifica-lo para verificar que o Kubernetes rejeita a operacao.',
        hints: [
          'Adicione o campo "immutable: true" no manifesto do ConfigMap',
          'Tente usar kubectl edit ou kubectl patch para modificar e observe o erro',
          'ConfigMaps imutaveis precisam ser deletados e recriados para mudar seus dados'
        ],
        solution: '```bash\n# Criar ConfigMap imutavel\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: app-config-v2\nimmutable: true\ndata:\n  APP_ENV: "production"\n  LOG_LEVEL: "info"\n  APP_PORT: "8080"\nEOF\n\n# Tentar modificar (deve falhar)\nkubectl patch configmap app-config-v2 \\\n  --type=merge \\\n  -p \'{"data":{"LOG_LEVEL":"debug"}}\'\n# Erro esperado: configmap is immutable\n\n# Limpar recursos\nkubectl delete pod config-test\nkubectl delete configmap app-config app-config-v2\nkubectl delete secret db-credentials\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod em CreateContainerConfigError por referencia invalida a ConfigMap ou Secret',
      symptom: 'Pod nao inicia e fica em estado CreateContainerConfigError (nao CrashLoopBackOff). O comando "kubectl describe pod" mostra erro: "configmap <nome> not found" ou "secret <nome> not found". O container nunca chega a ser criado.',
      diagnosis: '```bash\n# 1. Verificar o status do Pod\nkubectl get pod <nome-do-pod> -o wide\n# STATUS: CreateContainerConfigError\n\n# 2. Ver detalhes do erro\nkubectl describe pod <nome-do-pod>\n# Events: Error: configmap "app-config" not found\n# Ou: Error: secret "db-creds" not found\n\n# 3. Listar ConfigMaps e Secrets no namespace\nkubectl get configmaps -n <namespace>\nkubectl get secrets -n <namespace>\n\n# 4. Verificar o namespace do Pod\nkubectl get pod <nome-do-pod> -o jsonpath=\'{.metadata.namespace}\'\n\n# 5. Verificar exatamente quais CMs/Secrets o Pod referencia\nkubectl get pod <nome-do-pod> -o yaml | grep -A5 "configMapRef\\|secretKeyRef\\|configMap:\\|secretName:"\n```',
      solution: '```bash\n# Causa 1: ConfigMap/Secret nao existe no namespace\n# Criar o recurso ausente:\nkubectl create configmap app-config \\\n  --from-literal=KEY=value -n <namespace>\n\n# Causa 2: Nome incorreto (typo) no manifesto do Pod\n# Corrigir o nome no YAML e reaplicar\n\n# Causa 3: ConfigMap/Secret em namespace diferente\n# Copiar para o namespace correto:\nkubectl get configmap app-config -n outro-ns -o yaml \\\n  | sed \'s/namespace: outro-ns/namespace: correto/\' \\\n  | kubectl apply -f -\n\n# Causa 4: Usar optional: true para referencias nao-criticas\n# env.valueFrom.configMapKeyRef.optional: true\n\n# Verificar se o Pod passou a funcionar\nkubectl get pod <nome-do-pod> -w\n```'
    },
    {
      title: 'Secret com valor incorreto por codificacao base64 errada',
      symptom: 'Pod inicia normalmente, mas a aplicacao falha ao usar credenciais do Secret. A senha esta incorreta mesmo que o valor pareca correto no YAML. Erro tipico: "authentication failed" ou "invalid password".',
      diagnosis: '```bash\n# 1. Verificar o valor codificado\nkubectl get secret db-credentials -o yaml\n# data:\n#   password: bWluaGEtc2VuaGEK   <-- note o K no final\n\n# 2. Decodificar e verificar\nkubectl get secret db-credentials \\\n  -o jsonpath=\'{.data.password}\' | base64 --decode | xxd\n# Se houver \\n (0a) no final, o valor tem newline extra\n\n# 3. Causa mais comum: echo sem -n ao codificar\necho "minha-senha" | base64     # ERRADO: inclui newline\necho -n "minha-senha" | base64  # CORRETO: sem newline\n```',
      solution: '```bash\n# Opcao 1: Recriar com kubectl (codifica corretamente)\nkubectl delete secret db-credentials\nkubectl create secret generic db-credentials \\\n  --from-literal=password=minha-senha\n\n# Opcao 2: Usar stringData no YAML (evita erro de base64)\napiVersion: v1\nkind: Secret\nmetadata:\n  name: db-credentials\ntype: Opaque\nstringData:\n  password: minha-senha   # texto puro, K8s codifica\n\n# Opcao 3: Codificar corretamente\necho -n "minha-senha" | base64  # Sempre use -n!\n\n# Verificar o valor correto\nkubectl get secret db-credentials \\\n  -o jsonpath=\'{.data.password}\' | base64 --decode\n```'
    },
    {
      title: 'ConfigMap atualizado mas Pod nao reflete as mudancas',
      symptom: 'O ConfigMap foi atualizado com novos valores, mas o Pod continua usando os valores antigos. A aplicacao nao recebe as novas configuracoes.',
      diagnosis: '```bash\n# 1. Verificar se o ConfigMap foi realmente atualizado\nkubectl get configmap app-config -o yaml\n\n# 2. Verificar como o ConfigMap e consumido pelo Pod\nkubectl get pod <nome> -o yaml | grep -A10 "envFrom\\|configMapRef\\|configMap:"\n\n# 3. Se montado como volume, verificar o conteudo dentro do Pod\nkubectl exec <pod> -- cat /etc/config/KEY\n\n# 4. Se como env var, verificar a variavel\nkubectl exec <pod> -- env | grep KEY\n\n# 5. Verificar se o ConfigMap e imutavel\nkubectl get configmap app-config -o jsonpath=\'{.immutable}\'\n```',
      solution: '```bash\n# Cenario 1: ConfigMap usado como variavel de ambiente\n# Variaveis de ambiente NAO sao atualizadas automaticamente\n# Solucao: reiniciar o Pod\nkubectl delete pod <nome>\n# Ou: kubectl rollout restart deployment <nome>\n\n# Cenario 2: ConfigMap montado como volume com subPath\n# subPath NAO atualiza automaticamente\n# Solucao: remover subPath ou reiniciar o Pod\n\n# Cenario 3: ConfigMap montado como volume SEM subPath\n# Deveria atualizar em 1-2 minutos\n# Se nao atualizou, verificar se kubelet esta funcionando\n\n# Cenario 4: ConfigMap e imutavel\n# Deletar e recriar com novo nome (ex: app-config-v2)\n# Atualizar o Pod/Deployment para usar o novo nome\nkubectl delete configmap app-config\n# Recriar com immutable: false ou sem immutable\n```'
    }
  ]
};
