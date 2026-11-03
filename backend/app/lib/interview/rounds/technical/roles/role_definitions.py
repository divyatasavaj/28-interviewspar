from dataclasses import dataclass, field
from typing import Optional
from app.lib.interview.question_schema import TechnicalRole, DifficultyLevel


@dataclass
class RoleDefinition:
    role: TechnicalRole
    display_name: str
    description: str
    core_skills: list[str]
    secondary_skills: list[str]
    difficulty_progression: list[DifficultyLevel] = field(default_factory=lambda: [
        DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD
    ])
    question_categories: list[str] = field(default_factory=list)
    coding_focus: list[str] = field(default_factory=list)
    system_design_topics: list[str] = field(default_factory=list)
    experience_expectations: dict[str, str] = field(default_factory=dict)


ROLE_DEFINITIONS = {
    TechnicalRole.JUNIOR_FRONTEND: RoleDefinition(
        role=TechnicalRole.JUNIOR_FRONTEND,
        display_name="Junior Frontend Developer",
        description="Entry-level frontend developer focusing on React/Vue, HTML/CSS, JavaScript fundamentals",
        core_skills=["JavaScript", "React", "HTML/CSS", "TypeScript", "Git"],
        secondary_skills=["Redux", "Tailwind CSS", "Testing (Jest)", "Webpack/Vite", "REST APIs"],
        question_categories=[
            "JavaScript Fundamentals", "React Basics", "HTML/CSS", "TypeScript",
            "State Management", "Component Lifecycle", "Performance Basics"
        ],
        coding_focus=["Array/string manipulation", "DOM basics", "React components", "Hooks usage"],
        system_design_topics=["Component architecture", "State management patterns"],
        experience_expectations={
            "0-1": "Learning fundamentals, building small components",
            "1-2": "Independent feature development, debugging",
            "2-3": "Mentoring juniors, architectural decisions"
        }
    ),
    TechnicalRole.SENIOR_FRONTEND: RoleDefinition(
        role=TechnicalRole.SENIOR_FRONTEND,
        display_name="Senior Frontend Developer",
        description="Experienced frontend developer with architecture and performance expertise",
        core_skills=["JavaScript/TypeScript", "React/Vue", "State Management", "Performance", "Architecture"],
        secondary_skills=["Microfrontends", "SSR/SSG", "Testing Strategies", "CI/CD", "Design Systems"],
        question_categories=[
            "Advanced JavaScript", "React Architecture", "Performance Optimization",
            "State Management Patterns", "Testing Strategies", "Build Tools",
            "Accessibility", "Security", "Microfrontends"
        ],
        coding_focus=["Complex algorithms", "Custom hooks", "Performance patterns", "Architecture decisions"],
        system_design_topics=["Frontend architecture", "State management at scale", "Design systems", "Microfrontends"],
        experience_expectations={
            "3-5": "Leading features, code reviews, mentoring",
            "5-7": "Architecture decisions, cross-team coordination",
            "7+": "Technical strategy, platform decisions"
        }
    ),
    TechnicalRole.JUNIOR_BACKEND: RoleDefinition(
        role=TechnicalRole.JUNIOR_BACKEND,
        display_name="Junior Backend Developer",
        description="Entry-level backend developer focusing on APIs, databases, and server-side logic",
        core_skills=["Python/Node.js/Go", "SQL", "REST APIs", "Git", "Docker basics"],
        secondary_skills=["NoSQL", "Message Queues", "Caching", "Authentication", "Testing"],
        question_categories=[
            "Language Fundamentals", "Database Design", "API Design", "Authentication",
            "Caching", "Error Handling", "Testing", "Docker Basics"
        ],
        coding_focus=["CRUD operations", "Data validation", "API endpoints", "Database queries"],
        system_design_topics=["Service design", "Database schema", "API versioning"],
        experience_expectations={
            "0-1": "Learning framework, writing endpoints",
            "1-2": "Independent service development",
            "2-3": "Designing services, optimizing queries"
        }
    ),
    TechnicalRole.SENIOR_BACKEND: RoleDefinition(
        role=TechnicalRole.SENIOR_BACKEND,
        display_name="Senior Backend Developer",
        description="Experienced backend developer with distributed systems and scalability expertise",
        core_skills=["Distributed Systems", "Database Optimization", "System Design", "Microservices", "Cloud"],
        secondary_skills=["Event-driven Architecture", "gRPC", "Kubernetes", "Observability", "Security"],
        question_categories=[
            "Distributed Systems", "Database Internals", "Microservices Patterns",
            "Caching Strategies", "Message Queues", "System Design",
            "Performance Tuning", "Security", "Observability"
        ],
        coding_focus=["Concurrency", "Distributed algorithms", "Database optimization", "System design"],
        system_design_topics=["Scalable architectures", "Data consistency", "Service mesh", "Event sourcing"],
        experience_expectations={
            "3-5": "Leading services, design reviews",
            "5-7": "Architecture decisions, platform engineering",
            "7+": "Technical strategy, org-wide platforms"
        }
    ),
    TechnicalRole.FULLSTACK: RoleDefinition(
        role=TechnicalRole.FULLSTACK,
        display_name="Fullstack Developer",
        description="Versatile developer comfortable across frontend and backend",
        core_skills=["JavaScript/TypeScript", "React/Vue", "Node.js/Python", "SQL/NoSQL", "Git"],
        secondary_skills=["DevOps", "Cloud", "Testing", "CI/CD", "Architecture"],
        question_categories=[
            "Fullstack Architecture", "API Integration", "Database Design",
            "Frontend-Backend Communication", "Authentication", "Deployment"
        ],
        coding_focus=["End-to-end features", "API design", "Database modeling", "State sync"],
        system_design_topics=["Fullstack architecture", "Monorepo", "BFF pattern", "Real-time features"],
        experience_expectations={
            "1-3": "Building full features independently",
            "3-5": "Architecture decisions, team leadership",
            "5+": "Platform decisions, technical strategy"
        }
    ),
    TechnicalRole.DEVOPS: RoleDefinition(
        role=TechnicalRole.DEVOPS,
        display_name="DevOps Engineer",
        description="Infrastructure and deployment specialist with automation focus",
        core_skills=["Docker", "Kubernetes", "CI/CD", "Cloud (AWS/GCP/Azure)", "IaC (Terraform)"],
        secondary_skills=["Monitoring", "Logging", "Security", "Scripting", "Networking"],
        question_categories=[
            "Container Orchestration", "CI/CD Pipelines", "Infrastructure as Code",
            "Cloud Services", "Monitoring/Observability", "Security", "Networking"
        ],
        coding_focus=["Infrastructure scripts", "Pipeline configuration", "Automation"],
        system_design_topics=["Multi-cloud", "GitOps", "Platform engineering", "Disaster recovery"],
        experience_expectations={
            "1-3": "Managing pipelines, basic K8s",
            "3-5": "Platform engineering, multi-cluster",
            "5+": "Org-wide platform, cost optimization"
        }
    ),
    TechnicalRole.MOBILE: RoleDefinition(
        role=TechnicalRole.MOBILE,
        display_name="Mobile Developer",
        description="Mobile app developer for iOS/Android/React Native/Flutter",
        core_skills=["React Native/Flutter/Swift/Kotlin", "Mobile UI/UX", "State Management", "Native APIs"],
        secondary_skills=["App Store Deployment", "Testing", "Performance", "Offline Support", "Push Notifications"],
        question_categories=[
            "Mobile Architecture", "State Management", "Native Bridge",
            "Performance", "Offline/Storage", "Deployment", "Testing"
        ],
        coding_focus=["UI components", "Navigation", "Native modules", "Offline sync"],
        system_design_topics=["App architecture", "Offline-first", "Cross-platform", "Release management"],
        experience_expectations={
            "1-3": "Building features, app store deployment",
            "3-5": "Architecture, performance, team lead",
            "5+": "Platform strategy, SDK development"
        }
    ),
    TechnicalRole.ML_AI: RoleDefinition(
        role=TechnicalRole.ML_AI,
        display_name="ML/AI Engineer",
        description="Machine learning engineer building and deploying ML models",
        core_skills=["Python", "PyTorch/TensorFlow", "ML Algorithms", "Data Processing", "Model Deployment"],
        secondary_skills=["MLOps", "Feature Engineering", "NLP/CV", "Distributed Training", "Experiment Tracking"],
        question_categories=[
            "ML Fundamentals", "Deep Learning", "Model Deployment", "MLOps",
            "Data Pipelines", "Experiment Tracking", "Production ML"
        ],
        coding_focus=["Model training", "Data pipelines", "Inference optimization", "Feature engineering"],
        system_design_topics=["ML platform", "Feature stores", "Model serving", "A/B testing", "Monitoring"],
        experience_expectations={
            "1-3": "Model development, experimentation",
            "3-5": "Production deployment, MLOps",
            "5+": "ML platform, research to production"
        }
    ),
    TechnicalRole.QA_TEST: RoleDefinition(
        role=TechnicalRole.QA_TEST,
        display_name="QA/Test Engineer",
        description="Quality assurance engineer with automation focus",
        core_skills=["Test Automation", "Selenium/Playwright/Cypress", "API Testing", "CI/CD Integration"],
        secondary_skills=["Performance Testing", "Security Testing", "Test Strategy", "Mobile Testing"],
        question_categories=[
            "Test Automation", "API Testing", "Test Frameworks", "CI/CD Integration",
            "Performance Testing", "Test Strategy", "Bug Reporting"
        ],
        coding_focus=["Test scripts", "Framework development", "Automation patterns"],
        system_design_topics=["Test architecture", "Quality gates", "Test environments", "Contract testing"],
        experience_expectations={
            "1-3": "Writing automated tests, CI integration",
            "3-5": "Framework design, test strategy",
            "5+": "Quality platform, org-wide testing"
        }
    ),
    TechnicalRole.DATA_ENGINEER: RoleDefinition(
        role=TechnicalRole.DATA_ENGINEER,
        display_name="Data Engineer",
        description="Data pipeline and infrastructure specialist",
        core_skills=["SQL", "Python", "Spark/Flink", "Data Warehousing", "ETL/ELT"],
        secondary_skills=["Airflow", "dbt", "Data Modeling", "Streaming", "Data Quality"],
        question_categories=[
            "Data Modeling", "Pipeline Design", "Stream Processing", "Data Warehousing",
            "Data Quality", "Orchestration", "Performance Tuning"
        ],
        coding_focus=["SQL optimization", "Pipeline development", "Data transformation"],
        system_design_topics=["Data platform", "Lakehouse", "Real-time analytics", "Data governance"],
        experience_expectations={
            "1-3": "Building pipelines, SQL optimization",
            "3-5": "Platform design, streaming",
            "5+": "Data strategy, platform architecture"
        }
    ),
    TechnicalRole.SECURITY: RoleDefinition(
        role=TechnicalRole.SECURITY,
        display_name="Security Engineer",
        description="Application and infrastructure security specialist",
        core_skills=["Application Security", "Network Security", "Cryptography", "Compliance", "Threat Modeling"],
        secondary_skills=["Penetration Testing", "Security Tools", "Incident Response", "Zero Trust", "DevSecOps"],
        question_categories=[
            "App Security", "Network Security", "Cryptography", "Threat Modeling",
            "Compliance", "Incident Response", "DevSecOps"
        ],
        coding_focus=["Security tools", "Vulnerability scanning", "Secure coding patterns"],
        system_design_topics=["Security architecture", "Zero trust", "Secrets management", "Compliance automation"],
        experience_expectations={
            "1-3": "Security reviews, tooling",
            "3-5": "Architecture, incident response",
            "5+": "Security strategy, org-wide programs"
        }
    ),
    TechnicalRole.ENGINEERING_MANAGER: RoleDefinition(
        role=TechnicalRole.ENGINEERING_MANAGER,
        display_name="Engineering Manager (Technical Track)",
        description="Technical leader managing teams while staying hands-on",
        core_skills=["System Design", "Team Leadership", "Technical Strategy", "Architecture", "Mentoring"],
        secondary_skills=["Hiring", "Planning", "Cross-functional Collaboration", "Budget", "Vendor Management"],
        question_categories=[
            "Technical Leadership", "System Design", "Team Management", "Architecture Decisions",
            "Hiring/Growth", "Project Management", "Stakeholder Communication"
        ],
        coding_focus=["Architecture review", "Code review", "Technical decisions"],
        system_design_topics=["Organizational architecture", "Technical strategy", "Platform decisions", "Trade-offs"],
        experience_expectations={
            "3-5": "Team lead, project management",
            "5-7": "Multi-team, org strategy",
            "7+": "VP/CTO track, company strategy"
        }
    ),
}


def get_role_definition(role: TechnicalRole) -> Optional[RoleDefinition]:
    return ROLE_DEFINITIONS.get(role)


def get_all_roles() -> list[RoleDefinition]:
    return list(ROLE_DEFINITIONS.values())


def get_role_display_name(role: TechnicalRole) -> str:
    definition = get_role_definition(role)
    return definition.display_name if definition else role.value