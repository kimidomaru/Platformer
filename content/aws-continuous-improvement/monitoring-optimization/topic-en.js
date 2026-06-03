window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-continuous-improvement/monitoring-optimization'] = {
  theory: `# Monitoring, Logging & Optimization

## Exam Relevance
> **Continuous Improvement for Existing Solutions** is worth **25%** of SAP-C02. Advanced CloudWatch, X-Ray distributed tracing, Config compliance, Trusted Advisor, and Well-Architected reviews are core topics.

## Amazon CloudWatch Advanced

### Metrics & Monitoring
- **Custom Metrics**: publish app-level metrics via API or CloudWatch Agent (EC2, on-prem)
- **EMF (Embedded Metric Format)**: write structured logs that automatically extract metrics
- **Anomaly Detection**: ML-based dynamic thresholds for alarms (adapts to patterns)
- **Contributor Insights**: identify top contributors to high cardinality data (e.g., top 10 heavy API callers)
- **Metric Math**: perform calculations across metrics (sum, rate, percentile)
- **Cross-Account Observability**: aggregate metrics/logs/traces across accounts in an Organization

### CloudWatch Logs Insights
- Query language for CloudWatch Logs: parse JSON/text, filter, aggregate
- Visualize with dashboards or export to S3

### CloudWatch Dashboards
- Custom visual dashboards, cross-account, shared externally
- **Automatic Dashboards**: pre-built for AWS services

### Alarms
- Standard: single metric threshold
- Composite alarms: logical AND/OR of multiple alarms (reduce alarm noise)
- Treat missing data: 'breaching', 'notBreaching', 'ignore', 'missing'

## AWS X-Ray

Distributed tracing for microservices:
- **Segments**: a trace segment from one service
- **Subsegments**: breakdowns within a segment (downstream calls)
- **Service Map**: visual topology of services and connections
- **Sampling**: control percentage of requests traced (default 5% + 1/sec reservoir)
- **X-Ray Groups**: filter traces by expression, separate sampling rules
- **X-Ray Analytics**: aggregate trace data for percentile analysis

### Integration
- Lambda, EC2/ECS/EKS (via daemon), API Gateway, ALB, SNS, SQS
- SDK instrumented: Java, Python, Node.js, Go, .NET, Ruby

## AWS Config

Track resource configurations and compliance:
- **Config Rules**: evaluate resources against best practices
  - Managed rules: AWS-provided (over 300+)
  - Custom rules: Lambda-backed logic
- **Conformance Packs**: package of Config rules for frameworks (CIS, PCI DSS, HIPAA)
- **Remediation Actions**: auto-remediate via SSM Automation documents
- **Multi-account aggregator**: org-level compliance view
- **Config Recorder**: record config changes (can filter resource types)

## AWS Trusted Advisor

Automated best practice recommendations:
- **5 Categories**: Cost Optimization, Performance, Security, Fault Tolerance, Service Limits
- **Business/Enterprise support**: full access (all checks); Basic/Developer: limited checks
- **Trusted Advisor API**: programmatic access (support tier dependent)
- **CloudWatch Events**: alert when check status changes

## AWS Compute Optimizer

ML-based right-sizing recommendations:
- EC2 instances, Auto Scaling groups, Lambda functions, EBS volumes, ECS on Fargate
- Recommendations: over-provisioned / under-provisioned / optimized
- Considers CPU, memory, network metrics (last 14 days default, up to 3 months)
- Requires CloudWatch Agent for memory metrics

## AWS Well-Architected Tool

Framework-based architecture reviews:
- **Pillars**: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability
- **Lenses**: specialized views (Serverless, SaaS, Analytics, etc.)
- **Milestones**: snapshot architecture at points in time
- **Custom Lenses**: create organization-specific review questions

## Common Exam Mistakes

- Using standard CloudWatch alarms when composite alarms would reduce noise
- Not using Contributor Insights for high-cardinality issue identification
- Forgetting Config conformance packs for compliance frameworks
- Missing that Compute Optimizer requires CloudWatch Agent for memory-based recommendations
- Confusing X-Ray sampling (reduce data) with filtering (exclude from analysis)
`,

  quiz: [
    {
      question: 'What does CloudWatch Anomaly Detection do differently from standard threshold alarms?',
      options: ['It is cheaper', 'It uses ML to create dynamic thresholds that adapt to metric patterns (time of day, day of week)', 'It only works for EC2 metrics', 'It requires manual configuration of upper/lower bounds'],
      correct: 1,
      explanation: 'Anomaly Detection uses machine learning to model expected metric behavior based on historical patterns. Automatically adjusts for daily/weekly seasonality. No manual threshold setting needed.',
      reference: 'Anomaly Detection = ML dynamic thresholds. Standard alarms = fixed thresholds. Use AD for unpredictable metrics.'
    },
    {
      question: 'What is the purpose of CloudWatch Contributor Insights?',
      options: ['Track user behavior', 'Identify top N contributors causing high traffic/errors in high-cardinality log data', 'Alert on metric anomalies', 'Track API latency'],
      correct: 1,
      explanation: 'Contributor Insights analyzes log data to identify the top N contributors to a pattern. Example: top 10 IP addresses causing 5xx errors, or top 10 users consuming most API requests.',
      reference: 'Contributor Insights = top N contributors in high-cardinality data. Works with CloudWatch Logs.'
    },
    {
      question: 'What is AWS X-Ray sampling used for?',
      options: ['Filtering out noisy traces', 'Control the percentage of requests traced to reduce costs and data volume', 'Encrypting trace data', 'Sampling CPU metrics'],
      correct: 1,
      explanation: 'X-Ray sampling: by default traces 5% of requests plus 1 per second (reservoir). Custom sampling rules allow different rates per service/URL/method. Reduces storage costs while maintaining visibility.',
      reference: 'Sampling = reduce traced requests. Custom rules = different rates per service. Default = 5% + 1/sec reservoir.'
    },
    {
      question: 'What is the difference between a Config Rule and a Conformance Pack?',
      options: ['They are the same', 'Config Rule = single compliance check; Conformance Pack = collection of rules packaged for a compliance framework (CIS, PCI DSS)', 'Conformance Pack costs more', 'Config Rules can auto-remediate; Conformance Packs cannot'],
      correct: 1,
      explanation: 'Config Rule: single resource compliance check. Conformance Pack: collection of Config rules and remediation actions packaged together for compliance frameworks. Can be deployed to entire Organization.',
      reference: 'Config Rule = single check. Conformance Pack = framework package (CIS, PCI, HIPAA). Deploy to Org easily.'
    },
    {
      question: 'What additional data source does Compute Optimizer require for Lambda and EC2 memory recommendations?',
      options: ['X-Ray traces', 'CloudWatch Agent (for memory metrics, not available by default)', 'Cost Explorer data', 'Config rules'],
      correct: 1,
      explanation: 'Compute Optimizer analyzes CPU and network by default. Memory utilization requires CloudWatch Agent installed and configured to publish memory metrics. Without it, memory-based recommendations are unavailable.',
      reference: 'Compute Optimizer + memory = CloudWatch Agent required. CPU/network available by default.'
    },
    {
      question: 'What is a CloudWatch Composite Alarm?',
      options: ['An alarm that monitors composite metrics', 'An alarm that combines multiple alarms with AND/OR logic to reduce notification noise', 'An alarm for multiple regions', 'An alarm for multiple accounts'],
      correct: 1,
      explanation: 'Composite alarms: evaluate the state of multiple other alarms using AND/OR logic. Reduces alarm noise (only alert when multiple conditions are simultaneously in ALARM state). Cannot directly monitor metrics.',
      reference: 'Composite Alarm = AND/OR of other alarms. Reduces noise. Cannot directly evaluate metrics (only alarm states).'
    },
    {
      question: 'What does AWS Trusted Advisor check under the Security category?',
      options: ['Only IAM issues', 'Security groups with open ports, S3 bucket permissions, MFA on root, exposed access keys, CloudTrail enabled', 'Only encryption settings', 'Only network security'],
      correct: 1,
      explanation: 'Trusted Advisor Security checks include: Security Groups (unrestricted ports), S3 bucket permissions, MFA on root, exposed access keys, CloudTrail status, IAM use, and more. Full checks require Business/Enterprise support.',
      reference: 'Trusted Advisor Security = SGs, S3 permissions, root MFA, exposed keys, CloudTrail. Full access = Business/Enterprise.'
    },
    {
      question: 'What is the CloudWatch Embedded Metric Format (EMF)?',
      options: ['A JSON log format that CloudWatch automatically extracts as custom metrics — no separate PutMetricData calls', 'A CloudWatch dashboard format', 'A log compression format', 'A metric namespace format'],
      correct: 0,
      explanation: 'EMF: write structured JSON logs with a specific schema. CloudWatch automatically extracts the numeric values as custom metrics. Eliminates separate PutMetricData API calls. Works with Lambda, ECS, EC2.',
      reference: 'EMF = structured logs auto-extracted as metrics. No PutMetricData needed. For Lambda and containers.'
    }
  ],

  flashcards: [
    { front: 'CloudWatch advanced features?', back: 'Custom Metrics (API/Agent). EMF (structured log -> auto metric). Anomaly Detection (ML thresholds). Contributor Insights (top N contributors). Composite Alarms (AND/OR logic). Cross-Account Observability. Metric Math.' },
    { front: 'X-Ray concepts?', back: 'Segments: one service request. Subsegments: downstream calls. Service Map: visual topology. Sampling: default 5%+1/sec reservoir. Groups: filter by expression. Analytics: aggregate percentiles. Daemon: collect and send.' },
    { front: 'AWS Config features?', back: 'Config Rules: managed (300+) or custom (Lambda). Conformance Packs: rule bundles for CIS/PCI/HIPAA. Remediation: SSM Automation. Multi-account aggregator. Recorder: track config changes.' },
    { front: 'Trusted Advisor categories?', back: 'Cost Optimization (unused resources). Performance (instance types, CloudFront). Security (SGs, S3, MFA, keys). Fault Tolerance (backups, Multi-AZ). Service Limits. Business/Enterprise = full access.' },
    { front: 'Compute Optimizer?', back: 'ML right-sizing for EC2, ASG, Lambda, EBS, ECS Fargate. Over/Under/Optimized status. 14-day default (up to 3 months). Memory requires CloudWatch Agent. Free tier available.' },
    { front: 'Well-Architected pillars?', back: '6 pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability. Lenses: Serverless, SaaS, Analytics, etc. Milestones: snapshot over time.' },
    { front: 'CloudWatch Contributor Insights?', back: 'Identifies top N contributors to patterns in log data (high cardinality). Example: top 10 IPs causing errors, top customers consuming requests. Works with CloudWatch Logs. Rule-based analysis.' },
    { front: 'X-Ray vs CloudWatch?', back: 'X-Ray: distributed tracing, request flow across services, latency breakdown, service map. CloudWatch: metrics/logs/alarms, resource monitoring. Use both: X-Ray for request-level, CloudWatch for system-level.' }
  ],

  lab: {
    scenario: 'Implement comprehensive monitoring for a microservices application.',
    objective: 'Practice CloudWatch custom metrics, X-Ray tracing, and Config compliance rules.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Custom CloudWatch Metric and Alarm',
        instruction: 'Publish a custom business metric (order count) and create a composite alarm combining it with an error rate alarm.',
        hints: ['Custom metrics require PutMetricData or CloudWatch Agent', 'Composite alarms use alarm ARNs, not metrics'],
        solution: '```bash\n# Publish custom metric\naws cloudwatch put-metric-data \\\n  --namespace "MyApp/Orders" \\\n  --metric-name "OrderCount" \\\n  --value 150 \\\n  --unit Count \\\n  --dimensions Service=OrderService\n\n# Create alarm on custom metric\naws cloudwatch put-metric-alarm \\\n  --alarm-name "HighOrderVolume" \\\n  --namespace "MyApp/Orders" \\\n  --metric-name "OrderCount" \\\n  --threshold 1000 \\\n  --comparison-operator GreaterThanThreshold \\\n  --evaluation-periods 1 --period 300 \\\n  --statistic Sum\n\n# Create composite alarm\naws cloudwatch put-composite-alarm \\\n  --alarm-name "AppDegraded" \\\n  --alarm-rule "ALARM(HighErrorRate) AND ALARM(HighLatency)"\n```',
        verify: '```bash\naws cloudwatch list-metrics --namespace "MyApp/Orders"\n# Expected: OrderCount metric in MyApp/Orders namespace\n\naws cloudwatch describe-alarms --alarm-names AppDegraded\n# Expected: composite alarm with AND rule\n```'
      },
      {
        title: 'Enable X-Ray Tracing for Lambda',
        instruction: 'Enable X-Ray active tracing on a Lambda function and verify traces appear in the Service Map.',
        hints: ['X-Ray active mode traces all requests; PassThrough respects sampling', 'Lambda needs AWSXRayDaemonWriteAccess policy'],
        solution: '```bash\n# Enable X-Ray tracing on Lambda\naws lambda update-function-configuration \\\n  --function-name OrderProcessor \\\n  --tracing-config Mode=Active\n\n# Invoke function to generate traces\naws lambda invoke \\\n  --function-name OrderProcessor \\\n  --payload \'{"orderId":"test-123"}\' \\\n  /tmp/response.json\n\n# Get X-Ray trace summaries\naws xray get-trace-summaries \\\n  --start-time $(date -d "5 minutes ago" +%s) \\\n  --end-time $(date +%s)\n```',
        verify: '```bash\naws lambda get-function-configuration \\\n  --function-name OrderProcessor \\\n  --query "TracingConfig"\n# Expected: {"Mode": "Active"}\n\n# Check X-Ray service map (console recommended)\naws xray get-service-graph \\\n  --start-time $(date -d "10 minutes ago" +%s) \\\n  --end-time $(date +%s)\n# Expected: nodes for Lambda function and downstream calls\n```'
      },
      {
        title: 'Create Config Rule for S3 Encryption',
        instruction: 'Create a Config rule to check that all S3 buckets have server-side encryption enabled and configure auto-remediation.',
        hints: ['Use managed rule s3-bucket-server-side-encryption-enabled', 'Remediation uses SSM Automation documents'],
        solution: '```bash\n# Create Config rule\naws configservice put-config-rule --config-rule \'{\n  "ConfigRuleName": "s3-bucket-encryption",\n  "Source": {\n    "Owner": "AWS",\n    "SourceIdentifier": "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"\n  }\n}\'\n\n# Add remediation action\naws configservice put-remediation-configurations --remediation-configurations \'[{\n  "ConfigRuleName": "s3-bucket-encryption",\n  "TargetType": "SSM_DOCUMENT",\n  "TargetId": "AWSConfigRemediation-EnableS3BucketEncryption",\n  "Parameters": {\n    "AutomationAssumeRole": {"StaticValue":{"Values":["arn:aws:iam::ACCT:role/RemediationRole"]}},\n    "BucketName": {"ResourceValue":{"Value":"RESOURCE_ID"}}\n  },\n  "Automatic": true,\n  "MaximumAutomaticAttempts": 3\n}]\'\n```',
        verify: '```bash\naws configservice describe-config-rules \\\n  --config-rule-names s3-bucket-encryption\n# Expected: rule ACTIVE\n\naws configservice get-compliance-details-by-config-rule \\\n  --config-rule-name s3-bucket-encryption\n# Expected: list of COMPLIANT/NON_COMPLIANT resources\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'CloudWatch Alarm Not Triggering Despite Metric Exceeding Threshold',
      difficulty: 'medium',
      symptom: 'CloudWatch alarm stays in OK state even though metric values clearly exceed the configured threshold.',
      diagnosis: '```\nAlarm evaluation checklist:\n1. Missing data handling:\n   If metric not published = missing data\n   Default: treat as missing (not breaching)\n   Check: aws cloudwatch describe-alarms --alarm-names ALARM_NAME\n   Field: TreatMissingData\n\n2. Evaluation period vs period:\n   Alarm evaluates N consecutive periods\n   If metric publishes infrequently, gaps cause misses\n   Example: EvaluationPeriods=3, Period=60 = 3 minutes of data needed\n\n3. Metric resolution:\n   High-resolution metrics: 1/5/10/30 seconds\n   Standard: 60 seconds minimum\n   Alarm period must match metric resolution\n\n4. Namespace/dimension mismatch:\n   Alarm metric must exactly match published metric\n   Check: aws cloudwatch list-metrics --namespace NAMESPACE\n\n5. Alarm in INSUFFICIENT_DATA state:\n   Not enough data points to evaluate\n```',
      solution: 'Check TreatMissingData setting (set to breaching if gaps should trigger). Verify metric namespace and dimensions exactly match. Ensure metric is being published in the expected period. For high-frequency metrics, use high-resolution alarms. Check alarm history in CloudWatch console for evaluation details.'
    },
    {
      title: 'X-Ray Traces Missing for Some Services',
      difficulty: 'hard',
      symptom: 'X-Ray Service Map shows some services but key downstream dependencies are missing. Traces are incomplete.',
      diagnosis: '```\nX-Ray trace completeness checklist:\n1. SDK not instrumented:\n   Service must use X-Ray SDK or daemon\n   Check: is the X-Ray SDK included in the application?\n\n2. IAM permissions:\n   Service role needs xray:PutTraceSegments, xray:PutTelemetryRecords\n   Lambda: use AWSXRayDaemonWriteAccess managed policy\n\n3. Sampling rules:\n   If sampling rate = 0% for that service, no traces captured\n   Check: aws xray get-sampling-rules\n\n4. Active vs PassThrough tracing:\n   Lambda: PassThrough = only trace if upstream sent header\n   Active = trace all requests\n\n5. Missing context propagation:\n   HTTP services: check X-Amzn-Trace-Id header forwarded\n   SQS: X-Ray tracing for SQS needs explicit propagation\n\n6. X-Ray daemon not running:\n   ECS: is daemon sidecar container running?\n   EC2: is daemon process running?\n```',
      solution: 'Instrument all services with X-Ray SDK. Verify IAM roles have xray:PutTraceSegments permission. Check sampling rules are not excluding services. Enable Active tracing (not PassThrough) for Lambda. Verify trace header propagation across service boundaries. For ECS, confirm X-Ray daemon sidecar container is configured.'
    }
  ]
};
