
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'QUALITY_MANAGER', 'IT_MANAGER', 'DEPT_HEAD', 'SUPERVISOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER');

-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('VALID', 'EXPIRING', 'EXPIRED', 'IN_PROCESS', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "CalibrationResult" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "CalibrationEmailType" AS ENUM ('EXPIRING_SOON', 'EXPIRED', 'REMINDER', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationRuleType" AS ENUM ('EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationRulePeriod" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'YEARLY');

-- CreateEnum
CREATE TYPE "EscalationCategory" AS ENUM ('CUSTOMER_LINE_STOP', 'PRODUCT_SAFETY', 'RECALL', 'CONTROLLED_SHIPPING', 'SERIOUS_ACCIDENT', 'ENVIRONMENTAL_INCIDENT', 'CRITICAL_SUPPLY_ISSUE');

-- CreateEnum
CREATE TYPE "EscalationPriority" AS ENUM ('LEVEL_4_CRITICAL', 'LEVEL_3_HIGH', 'LEVEL_2_MEDIUM', 'LEVEL_1_LOW');

-- CreateEnum
CREATE TYPE "TaskEmailType" AS ENUM ('REMINDER', 'OVERDUE', 'COMPLETED', 'ESCALATION_MANAGER', 'ESCALATION_EXECUTIVE');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'IMPLEMENTED', 'CLOSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "SuggestionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('IMPROVEMENT', 'COST_REDUCTION', 'SAFETY', 'QUALITY', 'PRODUCTIVITY', 'ENVIRONMENT', 'EMPLOYEE_WELFARE', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'RETURNED', 'FORWARDED');

-- CreateEnum
CREATE TYPE "KaizenType" AS ENUM ('INDIVIDUAL', 'TEAM', 'PROJECT', 'QUICK');

-- CreateEnum
CREATE TYPE "KaizenStatus" AS ENUM ('DRAFT', 'PLANNING', 'IN_PROGRESS', 'CHECKING', 'COMPLETED', 'STANDARDIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PDCAStage" AS ENUM ('PLAN', 'DO', 'CHECK', 'ACT');

-- CreateEnum
CREATE TYPE "KaizenTeamRole" AS ENUM ('LEADER', 'MEMBER', 'SPONSOR', 'FACILITATOR');

-- CreateEnum
CREATE TYPE "NearMissType" AS ENUM ('FALLING', 'SLIPPING', 'TRIPPING', 'COLLISION', 'FALLING_OBJECT', 'ELECTRICAL', 'FIRE', 'CHEMICAL', 'MACHINERY', 'VEHICLE', 'ERGONOMIC', 'ENVIRONMENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "NearMissSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL', 'FATAL');

-- CreateEnum
CREATE TYPE "NearMissStatus" AS ENUM ('REPORTED', 'UNDER_INVESTIGATION', 'ACTION_REQUIRED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RootCauseCategory" AS ENUM ('HUMAN_ERROR', 'EQUIPMENT_FAILURE', 'PROCEDURE_GAP', 'TRAINING_GAP', 'ENVIRONMENTAL', 'MANAGEMENT', 'DESIGN_FLAW', 'COMMUNICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('IMMEDIATE', 'CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "FiveSAuditType" AS ENUM ('REGULAR', 'SPOT', 'FOLLOWUP', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "FiveSAuditStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "ActionPlanStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'CREATED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FiveSCategory" AS ENUM ('SEIRI', 'SEITON', 'SEISO', 'SEIKETSU', 'SHITSUKE');

-- CreateEnum
CREATE TYPE "FindingType" AS ENUM ('NON_CONFORMITY', 'OBSERVATION', 'IMPROVEMENT', 'BEST_PRACTICE');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('BEFORE', 'AFTER', 'EVIDENCE', 'GENERAL');

-- CreateEnum
CREATE TYPE "PointCategory" AS ENUM ('SUGGESTION_SUBMITTED', 'SUGGESTION_APPROVED', 'SUGGESTION_IMPLEMENTED', 'KAIZEN_PARTICIPATED', 'KAIZEN_COMPLETED', 'NEARMISS_REPORTED', 'NEARMISS_RESOLVED', 'FIVES_AUDIT', 'FIVES_IMPROVEMENT', 'BONUS', 'PENALTY');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AnnouncementTarget" AS ENUM ('ALL', 'DEPARTMENTS', 'ROLES');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'CELEBRATE', 'INSIGHTFUL', 'SUPPORT');

-- CreateEnum
CREATE TYPE "SurveyType" AS ENUM ('POLL', 'SURVEY', 'FEEDBACK', 'QUIZ');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SurveyResultVisibility" AS ENUM ('ALWAYS', 'AFTER_SUBMIT', 'AFTER_END', 'NEVER');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT_SHORT', 'TEXT_LONG', 'RATING', 'SCALE', 'YES_NO', 'DATE', 'FILE_UPLOAD', 'DROPDOWN', 'MATRIX');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'FILE', 'IMAGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('INCIDENT', 'SERVICE_REQUEST', 'PROBLEM', 'CHANGE_REQUEST');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED', 'REOPENED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('TICKET_LOW', 'NORMAL', 'TICKET_HIGH', 'TICKET_CRITICAL');

-- CreateEnum
CREATE TYPE "TicketImpact" AS ENUM ('INDIVIDUAL', 'DEPARTMENT', 'MULTIPLE_DEPTS', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "TicketUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('WEB_PORTAL', 'EMAIL', 'PHONE', 'WALK_IN', 'CHAT', 'SYSTEM_AUTO');

-- CreateEnum
CREATE TYPE "WorkLogType" AS ENUM ('REMOTE', 'ON_SITE', 'PHONE_SUPPORT', 'RESEARCH', 'DOCUMENTATION');

-- CreateEnum
CREATE TYPE "ArticleVisibility" AS ENUM ('PUBLIC', 'INTERNAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MachineType" AS ENUM ('CNC', 'LATHE', 'MILLING', 'DRILLING', 'GRINDING', 'PRESS', 'INJECTION', 'ASSEMBLY', 'CONVEYOR', 'PACKAGING', 'WELDING', 'CUTTING', 'TESTING', 'UTILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'IDLE', 'MAINTENANCE', 'BREAKDOWN', 'SETUP', 'RETIRED');

-- CreateEnum
CREATE TYPE "MachineCriticality" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'PREDICTIVE', 'CORRECTIVE', 'CONDITION_BASED', 'INSPECTION');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('BREAKDOWN', 'PREVENTIVE', 'PREDICTIVE', 'INSPECTION', 'IMPROVEMENT', 'INSTALLATION', 'CALIBRATION', 'CLEANING');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FailureType" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'ELECTRONIC', 'HYDRAULIC', 'PNEUMATIC', 'SOFTWARE', 'OPERATOR_ERROR', 'WEAR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DowntimeType" AS ENUM ('BREAKDOWN', 'PLANNED', 'SETUP', 'CHANGEOVER', 'NO_MATERIAL', 'NO_OPERATOR', 'QUALITY_ISSUE', 'POWER_OUTAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "LaborType" AS ENUM ('REPAIR', 'INSPECTION', 'PREVENTIVE', 'SETUP', 'TRAINING', 'TRAVEL');

-- CreateEnum
CREATE TYPE "MachineDocType" AS ENUM ('MANUAL', 'MAINTENANCE', 'SPARE_PARTS', 'DRAWING', 'CERTIFICATE', 'WARRANTY', 'OTHER');

-- CreateEnum
CREATE TYPE "QdmsDocumentCategory" AS ENUM ('PROCEDURE', 'INSTRUCTION', 'FORM', 'SPECIFICATION', 'MANUAL', 'POLICY', 'RECORD', 'EXTERNAL', 'TEMPLATE', 'OTHER');

-- CreateEnum
CREATE TYPE "QdmsDocumentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'OBSOLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QdmsApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "QdmsCapaType" AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'BOTH');

-- CreateEnum
CREATE TYPE "QdmsCapaStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QdmsCapaPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "QdmsNonConformanceLevel" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "QdmsAuditType" AS ENUM ('INTERNAL', 'EXTERNAL', 'SUPPLIER', 'CUSTOMER', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "QdmsAuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QdmsRiskLevel" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "QdmsSupplierStatus" AS ENUM ('PENDING', 'APPROVED', 'CONDITIONAL', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "QdmsChangeRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QdmsTrainingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('MANUAL', 'SCHEDULED', 'PRE_UPDATE', 'PRE_RESTORE');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "CompetencyCategory" AS ENUM ('CORE', 'LEADERSHIP', 'TECHNICAL', 'BEHAVIORAL', 'FUNCTIONAL');

-- CreateEnum
CREATE TYPE "PositionLevel" AS ENUM ('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "PositionSource" AS ENUM ('MANUAL', 'AD');

-- CreateEnum
CREATE TYPE "PerformanceLevel" AS ENUM ('LOW', 'MEETING', 'EXCEEDING');

-- CreateEnum
CREATE TYPE "PotentialLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RetentionRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EngagementLevel" AS ENUM ('DISENGAGED', 'NEUTRAL', 'ENGAGED', 'HIGHLY_ENGAGED');

-- CreateEnum
CREATE TYPE "SuccessionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SuccessionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VacancyRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'IMMINENT');

-- CreateEnum
CREATE TYPE "ReadinessLevel" AS ENUM ('READY_NOW', 'READY_1_YEAR', 'READY_2_YEARS', 'DEVELOPMENTAL');

-- CreateEnum
CREATE TYPE "CareerPathStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ACHIEVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DevelopmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DevelopmentCategory" AS ENUM ('TRAINING', 'EXPERIENCE', 'COACHING', 'PROJECT', 'CERTIFICATION', 'MENTORING', 'SHADOWING');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PARTIALLY', 'NOT_ACHIEVED');

-- CreateEnum
CREATE TYPE "MentorshipStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TalentActivityType" AS ENUM ('PROFILE_CREATED', 'PROFILE_UPDATED', 'COMPETENCY_ASSESSED', 'TALENT_SCORE_UPDATED', 'CAREER_PATH_CREATED', 'DEVELOPMENT_PLAN_CREATED', 'DEVELOPMENT_GOAL_COMPLETED', 'SUCCESSION_PLAN_CREATED', 'MENTORSHIP_STARTED', 'MENTORSHIP_COMPLETED', 'NINE_BOX_UPDATED', 'TAG_ADDED', 'TAG_REMOVED');

-- CreateEnum
CREATE TYPE "PersonnelRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PersonnelRequestType" AS ENUM ('NEW_POSITION', 'REPLACEMENT', 'EXPANSION', 'TEMPORARY', 'INTERN');

-- CreateEnum
CREATE TYPE "LoginStatus" AS ENUM ('SUCCESS', 'FAILED', 'LOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CycleType" AS ENUM ('ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "PerformanceCycleStatus" AS ENUM ('DRAFT', 'GOAL_SETTING', 'IN_PROGRESS', 'MID_YEAR', 'YEAR_END', 'CALIBRATION', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('NOT_STARTED', 'GOALS_SET', 'IN_PROGRESS', 'SELF_COMPLETED', 'MANAGER_COMPLETED', 'CALIBRATED', 'FINALIZED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "PerformanceRating" AS ENUM ('EXCEPTIONAL', 'EXCEEDS', 'MEETS', 'DEVELOPING', 'BELOW');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('BUSINESS', 'DEVELOPMENT', 'TEAM', 'LEADERSHIP');

-- CreateEnum
CREATE TYPE "MeasureType" AS ENUM ('QUANTITATIVE', 'QUALITATIVE');

-- CreateEnum
CREATE TYPE "GoalProgressStatus" AS ENUM ('NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeedbackProviderType" AS ENUM ('MANAGER', 'PEER', 'DIRECT_REPORT', 'SELF', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'DECLINED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "JobOpeningStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'OPEN', 'ON_HOLD', 'FILLED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('DIRECT', 'REFERRAL', 'LINKEDIN', 'JOB_BOARD', 'AGENCY', 'CAREER_FAIR', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'SCREENING', 'PHONE_SCREEN', 'INTERVIEW', 'ASSESSMENT', 'REFERENCE_CHECK', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('PHONE', 'VIDEO', 'ONSITE', 'PANEL', 'TECHNICAL', 'HR', 'CASE_STUDY');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "InterviewRecommendation" AS ENUM ('STRONG_YES', 'YES', 'MAYBE', 'NO', 'STRONG_NO');

-- CreateEnum
CREATE TYPE "HiringDecision" AS ENUM ('HIRE', 'REJECT', 'HOLD', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "OrgUnitType" AS ENUM ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM', 'GROUP', 'PROJECT');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED', 'RETIRED', 'VACANT');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "MilitaryStatus" AS ENUM ('COMPLETED', 'NOT_DONE', 'EXEMPT', 'POSTPONED');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('AGENCY', 'ISKUR', 'WEBSITE', 'REFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('PRIMARY_SCHOOL', 'HIGH_SCHOOL', 'ASSOCIATE', 'BACHELOR', 'MASTER', 'DOCTORATE');

-- CreateEnum
CREATE TYPE "Iso27001DocumentCategory" AS ENUM ('MANDATORY', 'RECORD', 'ANNEX_A', 'POLICY', 'PROCEDURE', 'GUIDELINE', 'FORM', 'OTHER');

-- CreateEnum
CREATE TYPE "Iso27001DocumentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'UNDER_REVIEW', 'OBSOLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Iso27001SignatureType" AS ENUM ('APPROVAL', 'REVIEW', 'ACKNOWLEDGMENT', 'WITNESS');

-- CreateEnum
CREATE TYPE "Iso27001ControlCategory" AS ENUM ('ORGANIZATIONAL', 'PEOPLE', 'PHYSICAL', 'TECHNOLOGICAL');

-- CreateEnum
CREATE TYPE "Iso27001ControlStatus" AS ENUM ('NOT_APPLICABLE', 'NOT_IMPLEMENTED', 'PARTIALLY', 'IMPLEMENTED', 'EFFECTIVE');

-- CreateEnum
CREATE TYPE "Iso27001Effectiveness" AS ENUM ('NOT_MEASURED', 'INEFFECTIVE', 'PARTIALLY_EFFECTIVE', 'EFFECTIVE', 'HIGHLY_EFFECTIVE');

-- CreateEnum
CREATE TYPE "Iso27001EvidenceType" AS ENUM ('DOCUMENT', 'SCREENSHOT', 'LOG', 'REPORT', 'CERTIFICATE', 'RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "Iso27001AuditProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Iso27001AuditType" AS ENUM ('INTERNAL', 'EXTERNAL', 'SURVEILLANCE', 'CERTIFICATION', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "Iso27001AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Iso27001FindingType" AS ENUM ('MAJOR_NC', 'MINOR_NC', 'OBSERVATION', 'OPPORTUNITY', 'POSITIVE');

-- CreateEnum
CREATE TYPE "Iso27001FindingSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'LOW');

-- CreateEnum
CREATE TYPE "Iso27001FindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "Iso27001ThreatCategory" AS ENUM ('NATURAL_DISASTER', 'CYBER_ATTACK', 'HUMAN', 'TECHNICAL_FAILURE', 'PHYSICAL_SECURITY', 'SUPPLY_CHAIN', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "Iso27001RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Iso27001RiskTreatment" AS ENUM ('AVOID', 'MITIGATE', 'TRANSFER', 'ACCEPT');

-- CreateEnum
CREATE TYPE "Iso27001RiskStatus" AS ENUM ('OPEN', 'IN_TREATMENT', 'CLOSED', 'MONITORING');

-- CreateEnum
CREATE TYPE "Iso27001TreatmentStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'MONITORING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Iso27001ReviewStatus" AS ENUM ('DRAFT', 'COMPLETED', 'APPROVED');

-- CreateEnum
CREATE TYPE "Iso27001TrainingType" AS ENUM ('AWARENESS', 'TECHNICAL', 'ORIENTATION', 'REFRESHER', 'SPECIALIZED');

-- CreateEnum
CREATE TYPE "Iso27001TrainingStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Iso27001AssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SIGNED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Iso27001AssetCategory" AS ENUM ('INFORMATION', 'SOFTWARE', 'HARDWARE', 'NETWORK', 'PERSONNEL', 'PHYSICAL', 'SERVICE', 'INTANGIBLE');

-- CreateEnum
CREATE TYPE "Iso27001AssetType" AS ENUM ('DATABASE', 'DOCUMENT', 'RECORD', 'BACKUP', 'APPLICATION', 'OPERATING_SYSTEM', 'MIDDLEWARE', 'DEVELOPMENT_TOOL', 'SERVER', 'DESKTOP', 'LAPTOP', 'MOBILE_DEVICE', 'STORAGE', 'PRINTER', 'ROUTER', 'SWITCH', 'FIREWALL', 'ACCESS_POINT', 'BUILDING', 'ROOM', 'CABINET', 'MEDIA', 'CLOUD_SERVICE', 'EXTERNAL_SERVICE', 'UTILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "Iso27001AssetCriticality" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "Iso27001Classification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "Iso27001AssetStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST');

-- CreateEnum
CREATE TYPE "Iso27001IncidentCategory" AS ENUM ('CYBER_ATTACK', 'UNAUTHORIZED_ACCESS', 'DATA_BREACH', 'SYSTEM_FAILURE', 'PHYSICAL_SECURITY', 'HUMAN_ERROR', 'POLICY_VIOLATION', 'SUPPLIER_RELATED');

-- CreateEnum
CREATE TYPE "Iso27001IncidentSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "Iso27001IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "Iso27001IncidentActionType" AS ENUM ('IMMEDIATE', 'CORRECTIVE', 'PREVENTIVE', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "Iso27001ActionPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "Iso27001ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'FAIR', 'TECHNICAL', 'AUDIT', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitReportStatus" AS ENUM ('DRAFT', 'SENT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ParticipantCompany" AS ENUM ('ILERI_GROUP', 'VISITED_COMPANY');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('BOARD', 'MANAGEMENT', 'DEPARTMENT', 'PROJECT', 'WEEKLY', 'MONTHLY', 'ONE_ON_ONE', 'BRAINSTORM', 'TRAINING', 'REVIEW', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('UNKNOWN', 'PRESENT', 'ABSENT', 'LATE', 'LEFT_EARLY', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendeeRole" AS ENUM ('CHAIRMAN', 'RAPPORTEUR', 'PRESENTER', 'PARTICIPANT', 'OBSERVER', 'GUEST');

-- CreateEnum
CREATE TYPE "AgendaOutcome" AS ENUM ('APPROVED', 'REJECTED', 'POSTPONED', 'NEEDS_INFO', 'NOTED', 'NO_DECISION');

-- CreateEnum
CREATE TYPE "AgendaItemStatus" AS ENUM ('PENDING', 'DISCUSSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CostAnalysisStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CostCurrency" AS ENUM ('TRY', 'EUR', 'USD', 'GBP');

-- CreateEnum
CREATE TYPE "MaterialCostCategory" AS ENUM ('RAW_MATERIAL', 'SEMI_FINISHED', 'PURCHASED_PART', 'STANDARD_PART', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "CostLaborType" AS ENUM ('INTERNAL', 'EXTERNAL', 'ASSEMBLY');

-- CreateEnum
CREATE TYPE "CostServiceType" AS ENUM ('PROCESSING', 'SURFACE_TREATMENT', 'TESTING', 'CERTIFICATION', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "OtherCostCategory" AS ENUM ('ASSEMBLY_LABOR', 'CONNECTION_PARTS', 'QUALITY_CONTROL', 'TRANSPORT', 'PACKAGING', 'ENGINEERING', 'TOOLING', 'CERTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "CostSupplierType" AS ENUM ('MATERIAL', 'SERVICE', 'BOTH');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('MEETING', 'TRAINING', 'CALIBRATION', 'FIRE_INSPECTION', 'LEAVE', 'HOLIDAY', 'REMINDER', 'OTHER');

-- CreateEnum
CREATE TYPE "OvertimeType" AS ENUM ('SATURDAY', 'SUNDAY', 'WEEKDAY_EXTRA', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('DRAFT', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Iso27001PenTestType" AS ENUM ('VULNERABILITY_ASSESSMENT', 'INTERNAL_PENTEST', 'EXTERNAL_PENTEST', 'WEB_APP', 'SOCIAL_ENGINEERING');

-- CreateEnum
CREATE TYPE "Iso27001PenTestStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED');

-- CreateEnum
CREATE TYPE "SupplierServiceType" AS ENUM ('IT_SERVICES', 'CLOUD_SERVICES', 'SECURITY_SERVICES', 'MAINTENANCE', 'TELECOM', 'CONSULTING', 'CLEANING', 'SECURITY_PHYSICAL', 'TRANSPORTATION', 'CATERING', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplierGroup" AS ENUM ('A_APPROVED', 'B_CANDIDATE', 'C_REJECTED', 'PENDING');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "SupplierBGRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('SERVICE', 'PRODUCT');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'COMPLETED', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "YakaRengi" AS ENUM ('MAVI', 'BEYAZ');

-- CreateEnum
CREATE TYPE "DirektEndirekt" AS ENUM ('DIREKT', 'ENDIREKT');

-- CreateEnum
CREATE TYPE "AsansorMekanik" AS ENUM ('ASANSOR', 'MEKANIK', 'YOK');

-- CreateEnum
CREATE TYPE "CourseDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO', 'PDF', 'DOCUMENT', 'QUIZ');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "azureAdId" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "image" TEXT,
    "department" TEXT,
    "jobTitle" TEXT,
    "officeLocation" TEXT,
    "mobilePhone" TEXT,
    "extension3cx" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "managerId" TEXT,
    "employeeId" TEXT,
    "tcLastFour" TEXT,
    "personnelId" TEXT,
    "duty" TEXT,
    "section" TEXT,
    "serviceRoute" TEXT,
    "serviceStop" TEXT,
    "signaturePin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "adOuName" TEXT,
    "adOuDn" TEXT,
    "managerId" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationProductionSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationProductionSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDeviceType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDeviceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDeviceModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDeviceModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDeviceName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDeviceName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationDevice" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "calibrationType" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "location" TEXT,
    "department" TEXT,
    "responsiblePerson" TEXT,
    "responsiblePersonEmail" TEXT,
    "responsibleUserId" TEXT,
    "departmentId" TEXT,
    "calibrationInterval" INTEGER,
    "lastCalibrationDate" TIMESTAMP(3),
    "nextCalibrationDate" TIMESTAMP(3),
    "certificateNumber" TEXT,
    "plannedCalibrationDate" TIMESTAMP(3),
    "verificationInterval" INTEGER,
    "lastVerificationDate" TIMESTAMP(3),
    "nextVerificationDate" TIMESTAMP(3),
    "plannedVerificationDate" TIMESTAMP(3),
    "deviceCondition" TEXT,
    "calibrationSentDate" TIMESTAMP(3),
    "calibrationReturnDate" TIMESTAMP(3),
    "scrapDate" TIMESTAMP(3),
    "scrapDescription" TEXT,
    "status" "CalibrationStatus" NOT NULL DEFAULT 'VALID',
    "statusManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresResponsible" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "attachments" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationHistory" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "calibrationDate" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "certificateNumber" TEXT,
    "calibratedBy" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "result" "CalibrationResult" NOT NULL DEFAULT 'PASS',
    "notes" TEXT,
    "certificatePath" TEXT,
    "attachments" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalibrationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationEmailLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientEmails" TEXT,
    "emailType" "CalibrationEmailType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,

    CONSTRAINT "CalibrationEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationNotificationEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT NOT NULL DEFAULT 'EXPIRING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationNotificationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalibrationNotificationRule" (
    "id" TEXT NOT NULL,
    "type" "NotificationRuleType" NOT NULL,
    "period" "NotificationRulePeriod" NOT NULL,
    "days" INTEGER NOT NULL,
    "repeatWeekly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalibrationNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceType" "RecurrenceType",
    "recurrenceInterval" INTEGER,
    "reminderDays" INTEGER[],
    "responsiblePerson" TEXT,
    "responsiblePersonEmail" TEXT,
    "responsibleDepartment" TEXT,
    "responsiblePersons" TEXT,
    "responsibleDepartments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notificationEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "attachments" TEXT,
    "escalationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "escalationCategory" "EscalationCategory",
    "escalationPriority" "EscalationPriority",
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "managerNotifiedAt" TIMESTAMP(3),
    "executiveNotifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentTaskId" TEXT,

    CONSTRAINT "PlannedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEmailLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "recipientEmails" TEXT NOT NULL,
    "emailType" "TaskEmailType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,

    CONSTRAINT "TaskEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskNotificationEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskNotificationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEscalationSettings" (
    "id" TEXT NOT NULL,
    "managerEscalationDays" INTEGER NOT NULL DEFAULT 1,
    "executiveEscalationDays" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskEscalationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskExecutiveEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskExecutiveEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "suggestionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "currentSituation" TEXT,
    "proposedSolution" TEXT,
    "expectedBenefit" TEXT,
    "estimatedSavings" DOUBLE PRECISION,
    "categoryId" TEXT,
    "priority" "SuggestionPriority" NOT NULL DEFAULT 'NORMAL',
    "suggestionType" "SuggestionType" NOT NULL DEFAULT 'IMPROVEMENT',
    "submittedBy" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedByDept" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "currentApprovalLevel" INTEGER NOT NULL DEFAULT 1,
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "assignedDept" TEXT,
    "implementedBy" TEXT,
    "implementedByName" TEXT,
    "implementedDate" TIMESTAMP(3),
    "actualSavings" DOUBLE PRECISION,
    "evaluationNotes" TEXT,
    "rejectionReason" TEXT,
    "attachments" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionApproval" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "approvalLevel" INTEGER NOT NULL,
    "approverEmail" TEXT NOT NULL,
    "approverName" TEXT NOT NULL,
    "approverRole" TEXT,
    "decision" "ApprovalDecision" NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionComment" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionTimeline" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "oldStatus" "SuggestionStatus",
    "newStatus" "SuggestionStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionSettings" (
    "id" TEXT NOT NULL,
    "pointsPerApproved" INTEGER NOT NULL DEFAULT 10,
    "pointsPerImplemented" INTEGER NOT NULL DEFAULT 25,
    "bonusPointsForSavings" BOOLEAN NOT NULL DEFAULT true,
    "requireDeptApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireUnitApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireExecApproval" BOOLEAN NOT NULL DEFAULT false,
    "execApprovalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "notifyOnSubmission" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnApproval" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnRejection" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnImplementation" BOOLEAN NOT NULL DEFAULT true,
    "allowAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionEvaluator" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "department" TEXT NOT NULL,
    "evaluatorEmail" TEXT NOT NULL,
    "evaluatorName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestionEvaluator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionBoardMember" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestionBoardMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaizenProject" (
    "id" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestionId" TEXT,
    "projectType" "KaizenType" NOT NULL DEFAULT 'INDIVIDUAL',
    "problemWhat" TEXT,
    "problemWhy" TEXT,
    "problemWhere" TEXT,
    "problemWhen" TEXT,
    "problemWho" TEXT,
    "problemHow" TEXT,
    "currentState" TEXT,
    "currentMetrics" TEXT,
    "targetState" TEXT,
    "targetMetrics" TEXT,
    "rootCauseAnalysis" TEXT,
    "proposedSolution" TEXT,
    "actionPlan" TEXT,
    "pdcaStage" "PDCAStage" NOT NULL DEFAULT 'PLAN',
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "teamLeaderId" TEXT,
    "teamLeaderName" TEXT,
    "teamLeaderEmail" TEXT,
    "departmentId" TEXT,
    "department" TEXT,
    "resultSummary" TEXT,
    "actualSavings" DOUBLE PRECISION,
    "qualityImprovement" DOUBLE PRECISION,
    "efficiencyImprovement" DOUBLE PRECISION,
    "status" "KaizenStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "SuggestionPriority" NOT NULL DEFAULT 'NORMAL',
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaizenProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaizenTeamMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "role" "KaizenTeamRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaizenTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaizenPDCAStep" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" "PDCAStage" NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsibleEmail" TEXT,
    "responsibleName" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaizenPDCAStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaizenAttachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "category" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaizenAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KaizenTimeline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "oldStage" "PDCAStage",
    "newStage" "PDCAStage",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KaizenTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMiss" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventLocation" TEXT NOT NULL,
    "locationDetails" TEXT,
    "eventType" "NearMissType" NOT NULL,
    "potentialSeverity" "NearMissSeverity" NOT NULL,
    "whatHappened" TEXT,
    "whyHappened" TEXT,
    "howHappened" TEXT,
    "affectedPersons" TEXT,
    "affectedEquipment" TEXT,
    "reportedBy" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "reportedByDept" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "witnesses" TEXT,
    "status" "NearMissStatus" NOT NULL DEFAULT 'REPORTED',
    "investigationNotes" TEXT,
    "rootCause" TEXT,
    "rootCauseCategory" "RootCauseCategory",
    "correctiveActions" TEXT,
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "assignedDept" TEXT,
    "closedBy" TEXT,
    "closedByName" TEXT,
    "closedAt" TIMESTAMP(3),
    "closureNotes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NearMiss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissAttachment" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NearMissAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissAction" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "SuggestionPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "assignedDept" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NearMissAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NearMissTimeline" (
    "id" TEXT NOT NULL,
    "nearMissId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "oldStatus" "NearMissStatus",
    "newStatus" "NearMissStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NearMissTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "location" TEXT,
    "responsibleEmail" TEXT,
    "responsibleName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiveSArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "seiriCriteria" TEXT NOT NULL,
    "seitonCriteria" TEXT NOT NULL,
    "seisoCriteria" TEXT NOT NULL,
    "seiketsuCriteria" TEXT NOT NULL,
    "shitsukeCriteria" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiveSTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSAudit" (
    "id" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "templateId" TEXT,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "auditType" "FiveSAuditType" NOT NULL DEFAULT 'REGULAR',
    "auditorEmail" TEXT NOT NULL,
    "auditorName" TEXT NOT NULL,
    "seiriScore" INTEGER NOT NULL DEFAULT 0,
    "seitonScore" INTEGER NOT NULL DEFAULT 0,
    "seisoScore" INTEGER NOT NULL DEFAULT 0,
    "seiketsuScore" INTEGER NOT NULL DEFAULT 0,
    "shitsukeScore" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "seiriDetails" TEXT,
    "seitonDetails" TEXT,
    "seisoDetails" TEXT,
    "seiketsuDetails" TEXT,
    "shitsukeDetails" TEXT,
    "strengths" TEXT,
    "improvements" TEXT,
    "notes" TEXT,
    "status" "FiveSAuditStatus" NOT NULL DEFAULT 'DRAFT',
    "actionPlanStatus" "ActionPlanStatus",
    "actionPlanCreatedAt" TIMESTAMP(3),
    "actionPlanCreatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiveSAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "sCategory" "FiveSCategory" NOT NULL,
    "findingType" "FindingType" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "priority" "SuggestionPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "correctiveAction" TEXT,
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "plannedTaskId" TEXT,
    "beforePhotoUrl" TEXT,
    "afterPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiveSFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSPhoto" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "sCategory" "FiveSCategory",
    "photoType" "PhotoType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "caption" TEXT,
    "location" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiveSPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveSSchedule" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "frequency" "RecurrenceType" NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "auditorEmail" TEXT,
    "auditorName" TEXT,
    "lastAuditDate" TIMESTAMP(3),
    "nextAuditDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiveSSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePoints" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "suggestionPoints" INTEGER NOT NULL DEFAULT 0,
    "kaizenPoints" INTEGER NOT NULL DEFAULT 0,
    "nearMissPoints" INTEGER NOT NULL DEFAULT 0,
    "fiveSPoints" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "badgesEarned" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointHistory" (
    "id" TEXT NOT NULL,
    "employeePointsId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "category" "PointCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT,
    "category" TEXT NOT NULL,
    "requiredPoints" INTEGER,
    "requiredCount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "categoryId" TEXT,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "targetType" "AnnouncementTarget" NOT NULL DEFAULT 'ALL',
    "targetDepartments" TEXT[],
    "targetRoles" TEXT[],
    "coverImageUrl" TEXT,
    "attachments" TEXT,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "allowReactions" BOOLEAN NOT NULL DEFAULT true,
    "requireAcknowledgment" BOOLEAN NOT NULL DEFAULT false,
    "surveyId" TEXT,
    "authorId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorDepartment" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userDepartment" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementComment" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementReaction" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "reactionType" "ReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "surveyNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "surveyType" "SurveyType" NOT NULL DEFAULT 'POLL',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "allowMultipleResponses" BOOLEAN NOT NULL DEFAULT false,
    "requireAllQuestions" BOOLEAN NOT NULL DEFAULT true,
    "showResults" "SurveyResultVisibility" NOT NULL DEFAULT 'AFTER_SUBMIT',
    "targetType" "AnnouncementTarget" NOT NULL DEFAULT 'ALL',
    "targetDepartments" TEXT[],
    "targetRoles" TEXT[],
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyQuestion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "showIf" TEXT,
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "minLength" INTEGER,
    "maxLength" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionText" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isOther" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "respondentEmail" TEXT,
    "respondentName" TEXT,
    "respondentDepartment" TEXT,
    "anonymousId" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "textAnswer" TEXT,
    "numericAnswer" INTEGER,
    "dateAnswer" TIMESTAMP(3),
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessageText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userDepartment" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'TEXT',
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "attachmentType" TEXT,
    "replyToId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReadReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "defaultPriority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "slaResponseMinutes" INTEGER,
    "slaResolutionMinutes" INTEGER,
    "defaultAssigneeEmail" TEXT,
    "defaultTeamId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTeam" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leadEmail" TEXT,
    "leadName" TEXT,
    "members" TEXT NOT NULL,
    "workingHoursStart" TEXT,
    "workingHoursEnd" TEXT,
    "workingDays" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ticketType" "TicketType" NOT NULL DEFAULT 'INCIDENT',
    "categoryId" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "impact" "TicketImpact" NOT NULL DEFAULT 'INDIVIDUAL',
    "urgency" "TicketUrgency" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterDept" TEXT,
    "requesterPhone" TEXT,
    "location" TEXT,
    "assetInfo" TEXT,
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "assignedTeamId" TEXT,
    "slaResponseDue" TIMESTAMP(3),
    "slaResolutionDue" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "slaResponseBreached" BOOLEAN NOT NULL DEFAULT false,
    "slaResolutionBreached" BOOLEAN NOT NULL DEFAULT false,
    "resolutionSummary" TEXT,
    "rootCause" TEXT,
    "satisfactionRating" INTEGER,
    "satisfactionComment" TEXT,
    "parentTicketId" TEXT,
    "attachments" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "TicketSource" NOT NULL DEFAULT 'WEB_PORTAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "isResolution" BOOLEAN NOT NULL DEFAULT false,
    "attachments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTimeline" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketWorkLog" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "technicianEmail" TEXT NOT NULL,
    "technicianName" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER NOT NULL,
    "workType" "WorkLogType" NOT NULL DEFAULT 'REMOTE',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLAPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lowResponseTime" INTEGER NOT NULL DEFAULT 480,
    "lowResolutionTime" INTEGER NOT NULL DEFAULT 2880,
    "normalResponseTime" INTEGER NOT NULL DEFAULT 240,
    "normalResolutionTime" INTEGER NOT NULL DEFAULT 1440,
    "highResponseTime" INTEGER NOT NULL DEFAULT 60,
    "highResolutionTime" INTEGER NOT NULL DEFAULT 480,
    "criticalResponseTime" INTEGER NOT NULL DEFAULT 15,
    "criticalResolutionTime" INTEGER NOT NULL DEFAULT 120,
    "businessHoursOnly" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SLAPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedTicketTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visibility" "ArticleVisibility" NOT NULL DEFAULT 'PUBLIC',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "machineCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "machineType" "MachineType" NOT NULL DEFAULT 'CNC',
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "yearOfManufacture" INTEGER,
    "purchaseDate" TIMESTAMP(3),
    "warrantyEndDate" TIMESTAMP(3),
    "location" TEXT,
    "area" TEXT,
    "department" TEXT,
    "responsibleEmail" TEXT,
    "responsibleName" TEXT,
    "specifications" TEXT,
    "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE',
    "criticalityLevel" "MachineCriticality" NOT NULL DEFAULT 'B',
    "operatingHoursCounter" INTEGER NOT NULL DEFAULT 0,
    "lastOperatingHoursUpdate" TIMESTAMP(3),
    "imageUrl" TEXT,
    "qrCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenancePlan" (
    "id" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "machineId" TEXT NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL DEFAULT 'PREVENTIVE',
    "frequencyType" TEXT NOT NULL DEFAULT 'TIME_BASED',
    "frequencyValue" INTEGER NOT NULL DEFAULT 30,
    "frequencyUnit" TEXT NOT NULL DEFAULT 'DAYS',
    "checklistItems" TEXT,
    "requiredParts" TEXT,
    "instructions" TEXT,
    "safetyNotes" TEXT,
    "estimatedDurationMinutes" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "assignedTeam" TEXT,
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "lastPerformedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "maintenancePlanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "workOrderType" "WorkOrderType" NOT NULL DEFAULT 'BREAKDOWN',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "reportedBy" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureCode" TEXT,
    "failureType" "FailureType",
    "failureSymptom" TEXT,
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "assignedTeam" TEXT,
    "assignedAt" TIMESTAMP(3),
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "completedByName" TEXT,
    "completionNotes" TEXT,
    "rootCause" TEXT,
    "laborCost" DOUBLE PRECISION,
    "partsCost" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "attachments" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DowntimeRecord" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "downtimeType" "DowntimeType" NOT NULL DEFAULT 'BREAKDOWN',
    "downtimeReason" TEXT,
    "plannedProduction" INTEGER,
    "lostProduction" INTEGER,
    "recordedBy" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DowntimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "partCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "manufacturer" TEXT,
    "supplierPartNo" TEXT,
    "supplierName" TEXT,
    "unitPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStockLevel" INTEGER,
    "reorderPoint" INTEGER,
    "stockLocation" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'Adet',
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineSparePartUsage" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "sparePartId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "usedBy" TEXT NOT NULL,
    "usedByName" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "MachineSparePartUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceLaborLog" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "technicianEmail" TEXT NOT NULL,
    "technicianName" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "laborType" "LaborType" NOT NULL DEFAULT 'REPAIR',
    "hourlyRate" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceLaborLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTimeline" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineDocument" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" "MachineDocType" NOT NULL DEFAULT 'MANUAL',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "uploadedBy" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineOEERecord" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "shift" TEXT,
    "plannedProductionTime" INTEGER NOT NULL,
    "actualRunTime" INTEGER NOT NULL,
    "downtime" INTEGER NOT NULL DEFAULT 0,
    "plannedOutput" INTEGER NOT NULL,
    "actualOutput" INTEGER NOT NULL,
    "defectCount" INTEGER NOT NULL DEFAULT 0,
    "availability" DOUBLE PRECISION NOT NULL,
    "performance" DOUBLE PRECISION NOT NULL,
    "quality" DOUBLE PRECISION NOT NULL,
    "oee" DOUBLE PRECISION NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "recordedByName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineOEERecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceKPITarget" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "targetOEE" DOUBLE PRECISION,
    "targetMTBF" DOUBLE PRECISION,
    "targetMTTR" DOUBLE PRECISION,
    "targetPMCompliance" DOUBLE PRECISION,
    "targetDowntime" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceKPITarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsDocument" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "QdmsDocumentCategory" NOT NULL,
    "departmentId" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "status" "QdmsDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "reviewPeriodMonths" INTEGER NOT NULL DEFAULT 12,
    "ownerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tags" TEXT[],
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "isControlledCopy" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "QdmsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsDocumentRevision" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "changeDescription" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "revisedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QdmsDocumentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsDocumentApproval" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "QdmsApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "signature" TEXT,
    "signatureHash" TEXT,
    "signatureTimestamp" TIMESTAMP(3),
    "signerIpAddress" TEXT,
    "signerUserAgent" TEXT,
    "verificationCode" TEXT,
    "dueDate" TIMESTAMP(3),
    "actionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QdmsDocumentApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsDocumentDistribution" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT,
    "departmentId" TEXT,
    "copyNumber" TEXT,
    "isControlled" BOOLEAN NOT NULL DEFAULT true,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QdmsDocumentDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsCapa" (
    "id" TEXT NOT NULL,
    "capaNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "QdmsCapaType" NOT NULL,
    "priority" "QdmsCapaPriority" NOT NULL,
    "status" "QdmsCapaStatus" NOT NULL DEFAULT 'OPEN',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceReference" TEXT,
    "departmentId" TEXT,
    "initiatorId" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "rootCause" TEXT,
    "rootCauseMethod" TEXT,
    "immediateAction" TEXT,
    "plannedActions" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "verificationMethod" TEXT,
    "verificationResult" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "effectivenessCheck" BOOLEAN NOT NULL DEFAULT false,
    "effectivenessResult" TEXT,
    "effectivenessDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "QdmsCapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsCapaAction" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "actionNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "status" "QdmsCapaStatus" NOT NULL DEFAULT 'OPEN',
    "completionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QdmsCapaAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsNonConformance" (
    "id" TEXT NOT NULL,
    "ncrNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" "QdmsNonConformanceLevel" NOT NULL,
    "category" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "detectedById" TEXT NOT NULL,
    "detectedArea" TEXT,
    "productId" TEXT,
    "batchNumber" TEXT,
    "quantity" INTEGER,
    "departmentId" TEXT,
    "disposition" TEXT,
    "dispositionById" TEXT,
    "dispositionDate" TIMESTAMP(3),
    "dispositionNotes" TEXT,
    "costOfNonConformance" DOUBLE PRECISION,
    "capaId" TEXT,
    "status" "QdmsCapaStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QdmsNonConformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsAudit" (
    "id" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "QdmsAuditType" NOT NULL,
    "standard" TEXT,
    "scope" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "duration" INTEGER,
    "departmentId" TEXT,
    "auditeeId" TEXT,
    "leadAuditorId" TEXT NOT NULL,
    "status" "QdmsAuditStatus" NOT NULL DEFAULT 'PLANNED',
    "summary" TEXT,
    "conclusion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QdmsAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsAuditTeamMember" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "QdmsAuditTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsAuditChecklist" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "clauseNumber" TEXT,
    "question" TEXT NOT NULL,
    "requirement" TEXT,
    "response" TEXT,
    "evidence" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QdmsAuditChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsAuditFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "findingNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "clauseReference" TEXT,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "capaRequired" BOOLEAN NOT NULL DEFAULT false,
    "capaId" TEXT,
    "status" "QdmsCapaStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QdmsAuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsRisk" (
    "id" TEXT NOT NULL,
    "riskNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "source" TEXT,
    "departmentId" TEXT,
    "likelihood" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "QdmsRiskLevel" NOT NULL,
    "currentControls" TEXT,
    "mitigationPlan" TEXT,
    "responsibleId" TEXT,
    "targetDate" TIMESTAMP(3),
    "residualLikelihood" INTEGER,
    "residualImpact" INTEGER,
    "residualRiskScore" INTEGER,
    "residualRiskLevel" "QdmsRiskLevel",
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QdmsRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsSupplier" (
    "id" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "category" TEXT,
    "products" TEXT,
    "status" "QdmsSupplierStatus" NOT NULL DEFAULT 'PENDING',
    "rating" DOUBLE PRECISION,
    "certifications" TEXT,
    "certExpiryDate" TIMESTAMP(3),
    "lastAuditDate" TIMESTAMP(3),
    "nextAuditDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QdmsSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsSupplierEvaluation" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "evaluationDate" TIMESTAMP(3) NOT NULL,
    "qualityScore" DOUBLE PRECISION,
    "deliveryScore" DOUBLE PRECISION,
    "priceScore" DOUBLE PRECISION,
    "serviceScore" DOUBLE PRECISION,
    "communicationScore" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "evaluatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QdmsSupplierEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsChangeRequest" (
    "id" TEXT NOT NULL,
    "changeNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" "QdmsCapaPriority" NOT NULL,
    "requesterId" TEXT NOT NULL,
    "departmentId" TEXT,
    "impactAnalysis" TEXT,
    "riskAssessment" TEXT,
    "costEstimate" DOUBLE PRECISION,
    "status" "QdmsChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "implementationPlan" TEXT,
    "implementedById" TEXT,
    "implementedAt" TIMESTAMP(3),
    "verificationResult" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "QdmsChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsChangeRequestApproval" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "QdmsApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "actionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QdmsChangeRequestApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsTrainingRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "trainingTitle" TEXT NOT NULL,
    "trainingType" TEXT NOT NULL,
    "status" "QdmsTrainingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "certificateUrl" TEXT,
    "trainerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QdmsTrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QdmsCustomerComplaint" (
    "id" TEXT NOT NULL,
    "complaintNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerContact" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "productId" TEXT,
    "batchNumber" TEXT,
    "category" TEXT,
    "priority" "QdmsCapaPriority" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "receivedById" TEXT NOT NULL,
    "source" TEXT,
    "responsibleId" TEXT,
    "departmentId" TEXT,
    "investigation" TEXT,
    "rootCause" TEXT,
    "resolution" TEXT,
    "customerResponse" TEXT,
    "capaRequired" BOOLEAN NOT NULL DEFAULT false,
    "capaId" TEXT,
    "status" "QdmsCapaStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QdmsCustomerComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupLog" (
    "id" TEXT NOT NULL,
    "backupName" TEXT NOT NULL,
    "backupType" "BackupType" NOT NULL,
    "projectName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL DEFAULT 0,
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "includeDatabase" BOOLEAN NOT NULL DEFAULT false,
    "excludePatterns" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "serverIp" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "frequency" "BackupFrequency" NOT NULL,
    "time" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "includeDatabase" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMenu" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "items" TEXT[],
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "holidayName" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "CompetencyCategory" NOT NULL,
    "level1Desc" TEXT,
    "level2Desc" TEXT,
    "level3Desc" TEXT,
    "level4Desc" TEXT,
    "level5Desc" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" "PositionLevel" NOT NULL,
    "description" TEXT,
    "source" "PositionSource" NOT NULL DEFAULT 'MANUAL',
    "adJobTitle" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "nextPositionId" TEXT,
    "minExperienceYears" INTEGER NOT NULL DEFAULT 0,
    "requiredEducation" TEXT,
    "requiredCertifications" TEXT[],
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionCompetency" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "department" TEXT,
    "currentPositionId" TEXT,
    "talentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "potentialScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "competencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performanceLevel" "PerformanceLevel" NOT NULL DEFAULT 'MEETING',
    "potentialLevel" "PotentialLevel" NOT NULL DEFAULT 'MEDIUM',
    "nineBoxPosition" TEXT,
    "retentionRisk" "RetentionRisk" NOT NULL DEFAULT 'LOW',
    "engagementLevel" "EngagementLevel" NOT NULL DEFAULT 'ENGAGED',
    "tags" TEXT[],
    "hireDate" DATE,
    "yearsOfService" DOUBLE PRECISION,
    "lastAssessedAt" TIMESTAMP(3),
    "lastAssessedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCompetency" (
    "id" TEXT NOT NULL,
    "talentProfileId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL,
    "targetLevel" INTEGER,
    "gap" INTEGER,
    "selfAssessment" INTEGER,
    "managerAssessment" INTEGER,
    "peerAssessment" DOUBLE PRECISION,
    "evidence" TEXT,
    "developmentNotes" TEXT,
    "lastAssessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessionPlan" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "currentHolderId" TEXT,
    "currentHolderEmail" TEXT,
    "currentHolderName" TEXT,
    "status" "SuccessionStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "SuccessionPriority" NOT NULL DEFAULT 'MEDIUM',
    "vacancyRisk" "VacancyRisk" NOT NULL DEFAULT 'LOW',
    "impactIfVacant" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuccessionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessionCandidate" (
    "id" TEXT NOT NULL,
    "successionPlanId" TEXT NOT NULL,
    "readiness" "ReadinessLevel" NOT NULL,
    "readyNowProfileId" TEXT,
    "readyIn1YearProfileId" TEXT,
    "readyIn2YearsProfileId" TEXT,
    "overallFit" INTEGER,
    "strengthsForRole" TEXT,
    "gapsForRole" TEXT,
    "developmentNeeded" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuccessionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerPath" (
    "id" TEXT NOT NULL,
    "talentProfileId" TEXT NOT NULL,
    "targetPositionId" TEXT NOT NULL,
    "targetDate" DATE,
    "estimatedMonths" INTEGER,
    "status" "CareerPathStatus" NOT NULL DEFAULT 'PLANNED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiredTrainings" TEXT[],
    "requiredCertifications" TEXT[],
    "requiredExperience" TEXT,
    "notes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentPlan" (
    "id" TEXT NOT NULL,
    "talentProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "DevelopmentStatus" NOT NULL DEFAULT 'DRAFT',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentGoal" (
    "id" TEXT NOT NULL,
    "developmentPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "DevelopmentCategory" NOT NULL,
    "relatedCompetencyCode" TEXT,
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "evidence" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevelopmentGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipRelation" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "focusArea" TEXT,
    "goals" TEXT,
    "status" "MentorshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "mentorFeedback" TEXT,
    "menteeFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentActivityLog" (
    "id" TEXT NOT NULL,
    "activityType" "TalentActivityType" NOT NULL,
    "employeeId" TEXT,
    "employeeEmail" TEXT,
    "employeeName" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "performedBy" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "year" INTEGER NOT NULL,
    "cycleType" "CycleType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "goalSettingStart" DATE,
    "goalSettingEnd" DATE,
    "midYearReviewStart" DATE,
    "midYearReviewEnd" DATE,
    "yearEndReviewStart" DATE,
    "yearEndReviewEnd" DATE,
    "calibrationStart" DATE,
    "calibrationEnd" DATE,
    "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeEmail" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeDepartment" TEXT,
    "managerId" TEXT,
    "managerEmail" TEXT,
    "managerName" TEXT,
    "goalScore" DOUBLE PRECISION,
    "competencyScore" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "goalRating" "PerformanceRating",
    "competencyRating" "PerformanceRating",
    "overallRating" "PerformanceRating",
    "selfAssessmentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "selfAssessmentDate" TIMESTAMP(3),
    "selfComments" TEXT,
    "managerAssessmentCompleted" BOOLEAN NOT NULL DEFAULT false,
    "managerAssessmentDate" TIMESTAMP(3),
    "managerComments" TEXT,
    "calibratedRating" "PerformanceRating",
    "calibrationNotes" TEXT,
    "finalRating" "PerformanceRating",
    "finalComments" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "employeeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "employeeAcknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceGoal" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "GoalCategory" NOT NULL,
    "measureType" "MeasureType" NOT NULL,
    "targetValue" TEXT,
    "actualValue" TEXT,
    "unit" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "selfRating" INTEGER,
    "managerRating" INTEGER,
    "finalRating" INTEGER,
    "selfComments" TEXT,
    "managerComments" TEXT,
    "status" "GoalProgressStatus" NOT NULL DEFAULT 'ON_TRACK',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" DATE,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackRequest" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectEmail" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerEmail" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerType" "FeedbackProviderType" NOT NULL,
    "cycleId" TEXT,
    "cycleName" TEXT,
    "overallComments" TEXT,
    "strengthsComment" TEXT,
    "improvementComment" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "dueDate" DATE,
    "requestedBy" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackResponse" (
    "id" TEXT NOT NULL,
    "feedbackRequestId" TEXT NOT NULL,
    "questionCode" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requestType" "PersonnelRequestType" NOT NULL DEFAULT 'NEW_POSITION',
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "justification" TEXT NOT NULL,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "preferredStartDate" DATE,
    "location" TEXT,
    "workModel" TEXT,
    "salaryMin" DOUBLE PRECISION,
    "salaryMax" DOUBLE PRECISION,
    "hasBudget" BOOLEAN NOT NULL DEFAULT false,
    "status" "PersonnelRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "JobPriority" NOT NULL DEFAULT 'MEDIUM',
    "approvedById" TEXT,
    "approvedByEmail" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "rejectedById" TEXT,
    "rejectedByEmail" TEXT,
    "rejectedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "jobOpeningId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonnelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOpening" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "location" TEXT,
    "employmentType" "EmploymentType" NOT NULL,
    "positionId" TEXT,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "qualifications" TEXT,
    "benefits" TEXT,
    "salaryMin" DOUBLE PRECISION,
    "salaryMax" DOUBLE PRECISION,
    "salaryCurrency" TEXT DEFAULT 'TRY',
    "showSalary" BOOLEAN NOT NULL DEFAULT false,
    "hiringManagerId" TEXT,
    "hiringManagerEmail" TEXT,
    "hiringManagerName" TEXT,
    "recruiterId" TEXT,
    "recruiterEmail" TEXT,
    "recruiterName" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "filledCount" INTEGER NOT NULL DEFAULT 0,
    "postingDate" DATE,
    "closingDate" DATE,
    "targetHireDate" DATE,
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "JobPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "currentTitle" TEXT,
    "currentCompany" TEXT,
    "yearsOfExperience" DOUBLE PRECISION,
    "education" TEXT,
    "skills" TEXT[],
    "resumeUrl" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "source" "CandidateSource" NOT NULL,
    "referredBy" TEXT,
    "notes" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "currentStage" TEXT,
    "overallRating" INTEGER,
    "fitScore" INTEGER,
    "decision" "HiringDecision",
    "decisionNotes" TEXT,
    "decisionBy" TEXT,
    "decisionByName" TEXT,
    "decisionAt" TIMESTAMP(3),
    "offerExtended" BOOLEAN NOT NULL DEFAULT false,
    "offerAccepted" BOOLEAN,
    "offerAmount" DOUBLE PRECISION,
    "offerDate" DATE,
    "startDate" DATE,
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewStage" (
    "id" TEXT NOT NULL,
    "jobOpeningId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "interviewType" "InterviewType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "evaluatorEmails" TEXT[],
    "evaluationCriteria" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "stageOrder" INTEGER,
    "interviewType" "InterviewType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "location" TEXT,
    "interviewerIds" TEXT[],
    "interviewerEmails" TEXT[],
    "interviewerNames" TEXT[],
    "overallRating" INTEGER,
    "recommendation" "InterviewRecommendation",
    "notes" TEXT,
    "strengthsNoted" TEXT,
    "concernsNoted" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "completedAt" TIMESTAMP(3),
    "feedbackSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "unitType" "OrgUnitType" NOT NULL,
    "managerId" TEXT,
    "managerEmail" TEXT,
    "managerName" TEXT,
    "managerPhoto" TEXT,
    "location" TEXT,
    "costCenter" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "approvedHeadcount" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgEmployee" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "orgUnitId" TEXT NOT NULL,
    "reportsToId" TEXT,
    "positionTitle" TEXT,
    "positionLevel" "PositionLevel",
    "hireDate" DATE,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "workLocation" TEXT,
    "phone" TEXT,
    "officeLocation" TEXT,
    "photoUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "department" TEXT,
    "role" TEXT,
    "status" "LoginStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicJobApplication" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthPlace" TEXT,
    "birthDate" TIMESTAMP(3),
    "nationality" TEXT,
    "tcKimlikNo" TEXT,
    "gender" "Gender",
    "bloodType" "BloodType",
    "militaryStatus" "MilitaryStatus",
    "militaryPostponeDate" TIMESTAMP(3),
    "maritalStatus" "MaritalStatus",
    "numberOfChildren" INTEGER DEFAULT 0,
    "spouseWorking" BOOLEAN,
    "spouseOccupation" TEXT,
    "homeAddress" TEXT,
    "dependents" TEXT,
    "mobilePhone" TEXT,
    "workPhone" TEXT,
    "homePhone" TEXT,
    "email" TEXT,
    "referralSource" "ReferralSource",
    "referralSourceOther" TEXT,
    "memberships" TEXT,
    "hasDriverLicense" BOOLEAN,
    "driverLicenseClass" TEXT,
    "driverLicenseDate" TIMESTAMP(3),
    "photoUrl" TEXT,
    "hasCriminalRecord" BOOLEAN,
    "hasConviction" BOOLEAN,
    "convictionDetails" TEXT,
    "hasOngoingCase" BOOLEAN,
    "height" INTEGER,
    "weight" INTEGER,
    "shoeSize" TEXT,
    "clothingSizeUpper" TEXT,
    "clothingSizeLower" TEXT,
    "hasTravelRestriction" BOOLEAN,
    "canWorkShifts" BOOLEAN,
    "hobbies" TEXT,
    "availableStartDate" TIMESTAMP(3),
    "expectedSalary" INTEGER,
    "requestedPosition" TEXT,
    "previouslyWorkedHere" BOOLEAN,
    "educationLevel" "EducationLevel",
    "educationHistory" JSONB,
    "coursesAndSeminars" JSONB,
    "foreignLanguages" JSONB,
    "computerSkills" JSONB,
    "workExperience" JSONB,
    "hasRelativesInCompany" BOOLEAN,
    "relativeName" TEXT,
    "preferredContactGsm" BOOLEAN,
    "preferredContactEmail" BOOLEAN,
    "preferredContactOther" TEXT,
    "canContactLastEmployer" BOOLEAN,
    "references" JSONB,
    "declarationAccepted" BOOLEAN,
    "declarationDate" TIMESTAMP(3),
    "digitalSignature" TEXT,
    "signatureDate" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicJobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Document" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "Iso27001DocumentCategory" NOT NULL,
    "clause" TEXT,
    "controlId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isLatestVersion" BOOLEAN NOT NULL DEFAULT true,
    "previousVersionId" TEXT,
    "status" "Iso27001DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "departmentId" TEXT,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "lastReviewDate" TIMESTAMP(3),
    "reviewFrequency" INTEGER DEFAULT 365,
    "contentHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "contentHash" TEXT,
    "changeDescription" TEXT,
    "changedById" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iso27001DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Signature" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signerTitle" TEXT,
    "signerDepartment" TEXT,
    "signatureCode" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signatureType" "Iso27001SignatureType" NOT NULL DEFAULT 'APPROVAL',
    "notes" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Iso27001Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Control" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleTr" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionTr" TEXT,
    "category" "Iso27001ControlCategory" NOT NULL,
    "categoryNumber" INTEGER NOT NULL,
    "controlNumber" INTEGER NOT NULL,
    "status" "Iso27001ControlStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "applicability" BOOLEAN NOT NULL DEFAULT true,
    "justification" TEXT,
    "implementationNotes" TEXT,
    "implementationDate" TIMESTAMP(3),
    "controlSource" TEXT,
    "relatedAssets" TEXT,
    "responsibleId" TEXT,
    "responsibleName" TEXT,
    "responsibleEmail" TEXT,
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "effectiveness" "Iso27001Effectiveness",
    "effectivenessNotes" TEXT,
    "effectivenessDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001ControlDocument" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "relationshipType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iso27001ControlDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Evidence" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evidenceType" "Iso27001EvidenceType" NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "referenceUrl" TEXT,
    "referenceNote" TEXT,
    "evidenceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iso27001Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001AuditProgram" (
    "id" TEXT NOT NULL,
    "programNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" TEXT NOT NULL DEFAULT 'Rev.01',
    "publishDate" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodLabel" TEXT,
    "purpose" TEXT,
    "auditApproach" TEXT[],
    "status" "Iso27001AuditProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "preparedByName" TEXT NOT NULL,
    "preparedByTitle" TEXT,
    "reviewedByName" TEXT,
    "reviewedByTitle" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "approvedByTitle" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001AuditProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001AuditProgramAuditor" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "title" TEXT,
    "certifications" TEXT[],
    "experienceYears" INTEGER,
    "email" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iso27001AuditProgramAuditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001AuditProgramItem" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "auditArea" TEXT NOT NULL,
    "scope" TEXT,
    "plannedDate" TEXT,
    "leadAuditorName" TEXT NOT NULL,
    "duration" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planlandı',
    "auditId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001AuditProgramItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Audit" (
    "id" TEXT NOT NULL,
    "auditNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "auditType" "Iso27001AuditType" NOT NULL,
    "scope" TEXT,
    "clauses" TEXT[],
    "controls" TEXT[],
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "leadAuditorId" TEXT NOT NULL,
    "leadAuditorName" TEXT NOT NULL,
    "leadAuditorEmail" TEXT NOT NULL,
    "auditeeId" TEXT,
    "auditeeName" TEXT,
    "auditeeEmail" TEXT,
    "auditeeDepartment" TEXT,
    "status" "Iso27001AuditStatus" NOT NULL DEFAULT 'PLANNED',
    "summary" TEXT,
    "conclusion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001AuditTeamMember" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "memberEmail" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iso27001AuditTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001AuditFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "findingNumber" TEXT NOT NULL,
    "controlId" TEXT,
    "clause" TEXT,
    "findingType" "Iso27001FindingType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "severity" "Iso27001FindingSeverity" NOT NULL DEFAULT 'MINOR',
    "correctiveAction" TEXT,
    "responsibleId" TEXT,
    "responsibleName" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verifiedByName" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "status" "Iso27001FindingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Threat" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "Iso27001ThreatCategory" NOT NULL,
    "description" TEXT,
    "affectedAssetTypes" TEXT,
    "typicalLikelihood" INTEGER NOT NULL DEFAULT 3,
    "typicalImpact" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001Threat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Risk" (
    "id" TEXT NOT NULL,
    "riskNumber" TEXT NOT NULL,
    "assetId" TEXT,
    "assetName" TEXT NOT NULL,
    "assetValue" INTEGER NOT NULL,
    "threatId" TEXT,
    "threatName" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "vulnerability" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "existingControls" TEXT,
    "likelihood" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "Iso27001RiskLevel" NOT NULL,
    "treatmentOption" "Iso27001RiskTreatment",
    "treatmentSummary" TEXT,
    "residualLikelihood" INTEGER,
    "residualImpact" INTEGER,
    "residualRiskScore" INTEGER,
    "residualRiskLevel" "Iso27001RiskLevel",
    "relatedControls" TEXT[],
    "ownerId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "identifiedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "status" "Iso27001RiskStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001RiskTreatmentPlan" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "treatmentOption" "Iso27001RiskTreatment" NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "responsibleEmail" TEXT,
    "targetDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "status" "Iso27001TreatmentStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001RiskTreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001ManagementReview" (
    "id" TEXT NOT NULL,
    "reviewNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "participants" TEXT NOT NULL,
    "chairperson" TEXT NOT NULL,
    "auditResults" TEXT,
    "feedbacks" TEXT,
    "incidentSummary" TEXT,
    "riskStatus" TEXT,
    "objectivesStatus" TEXT,
    "previousActions" TEXT,
    "changes" TEXT,
    "improvements" TEXT,
    "decisions" TEXT,
    "actionItems" TEXT,
    "resourceNeeds" TEXT,
    "status" "Iso27001ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "minutesUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001ManagementReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Training" (
    "id" TEXT NOT NULL,
    "trainingNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "trainingType" "Iso27001TrainingType" NOT NULL DEFAULT 'AWARENESS',
    "duration" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "contentType" TEXT,
    "contentUrl" TEXT,
    "minViewTime" INTEGER,
    "hasQuiz" BOOLEAN NOT NULL DEFAULT false,
    "passingScore" INTEGER,
    "trainerName" TEXT NOT NULL,
    "trainerTitle" TEXT,
    "trainerEmail" TEXT,
    "trainingDate" TIMESTAMP(3) NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "controlId" TEXT,
    "documentUrl" TEXT,
    "signatureUrl" TEXT,
    "status" "Iso27001TrainingStatus" NOT NULL DEFAULT 'PLANNED',
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001TrainingParticipant" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iso27001TrainingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001TrainingAssignment" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    "assignedByName" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "Iso27001AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "viewTime" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "quizScore" INTEGER,
    "quizAttempts" INTEGER NOT NULL DEFAULT 0,
    "quizPassedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signatureHash" TEXT,
    "signatureIp" TEXT,
    "signatureDevice" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001TrainingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Asset" (
    "id" TEXT NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "Iso27001AssetCategory" NOT NULL,
    "type" "Iso27001AssetType" NOT NULL,
    "location" TEXT,
    "department" TEXT,
    "ownerId" TEXT,
    "custodianId" TEXT,
    "confidentiality" INTEGER NOT NULL DEFAULT 1,
    "integrity" INTEGER NOT NULL DEFAULT 1,
    "availability" INTEGER NOT NULL DEFAULT 1,
    "assetValue" INTEGER,
    "financialValue" DOUBLE PRECISION,
    "criticality" "Iso27001AssetCriticality" NOT NULL DEFAULT 'LOW',
    "classification" "Iso27001Classification" NOT NULL DEFAULT 'INTERNAL',
    "status" "Iso27001AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "acquisitionDate" TIMESTAMP(3),
    "disposalDate" TIMESTAMP(3),
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "version" TEXT,
    "licenseType" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "hostname" TEXT,
    "ipAddress" TEXT,
    "macAddress" TEXT,
    "operatingSystem" TEXT,
    "processor" TEXT,
    "ram" TEXT,
    "diskSize" TEXT,
    "barcode" TEXT,
    "warrantyEndDate" TIMESTAMP(3),
    "assignedTo" TEXT,
    "assignedToEmail" TEXT,
    "parentAssetId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),

    CONSTRAINT "Iso27001Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001Incident" (
    "id" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "Iso27001IncidentCategory" NOT NULL,
    "severity" "Iso27001IncidentSeverity" NOT NULL,
    "status" "Iso27001IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "detectionMethod" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedById" TEXT,
    "reportedByName" TEXT,
    "affectedSystems" TEXT,
    "affectedAssets" TEXT,
    "impactScope" TEXT,
    "assignedToId" TEXT,
    "immediateActions" TEXT,
    "containmentAt" TIMESTAMP(3),
    "rootCause" TEXT,
    "rootCauseAnalyzedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "correctiveAction" TEXT,
    "preventiveAction" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closureNotes" TEXT,
    "lessonsLearned" TEXT,
    "relatedControls" TEXT,
    "relatedRiskIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001IncidentAttachment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iso27001IncidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001IncidentAction" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actionType" "Iso27001IncidentActionType" NOT NULL,
    "priority" "Iso27001ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "Iso27001ActionStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001IncidentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001IncidentTimeline" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "performedById" TEXT,
    "performedByName" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iso27001IncidentTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitReport" (
    "id" TEXT NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "visitTime" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "visitType" "VisitType" NOT NULL,
    "location" TEXT,
    "project" TEXT,
    "meetingSummary" TEXT NOT NULL,
    "additionalNotes" TEXT,
    "nextSteps" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "VisitReportStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitReportParticipant" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" "ParticipantCompany" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitReportParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitReportAction" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ActionItemStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitReportAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitReportAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitReportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitReportEmailLog" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "sentByName" TEXT,
    "recipients" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitReportEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "meetingNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingType" "MeetingType" NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "onlineLink" TEXT,
    "organizerId" TEXT NOT NULL,
    "chairmanId" TEXT,
    "rapporteurId" TEXT,
    "department" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PLANNED',
    "minutesApproved" BOOLEAN NOT NULL DEFAULT false,
    "minutesApprovedAt" TIMESTAMP(3),
    "minutesApprovedById" TEXT,
    "openingRemarks" TEXT,
    "closingRemarks" TEXT,
    "generalNotes" TEXT,
    "previousMeetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "externalName" TEXT,
    "externalEmail" TEXT,
    "externalCompany" TEXT,
    "externalTitle" TEXT,
    "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "absenceReason" TEXT,
    "role" "AttendeeRole" NOT NULL DEFAULT 'PARTICIPANT',
    "arrivalTime" TIMESTAMP(3),
    "departureTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "presenterId" TEXT,
    "presenterName" TEXT,
    "plannedDuration" INTEGER,
    "actualDuration" INTEGER,
    "discussionNotes" TEXT,
    "outcome" "AgendaOutcome",
    "outcomeNotes" TEXT,
    "votesFor" INTEGER,
    "votesAgainst" INTEGER,
    "votesAbstain" INTEGER,
    "status" "AgendaItemStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingDecision" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "decisionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleId" TEXT,
    "responsibleName" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "MeetingPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "DecisionStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completionNotes" TEXT,
    "linkedTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttachment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPlan" (
    "id" TEXT NOT NULL,
    "planNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "label1" TEXT NOT NULL DEFAULT 'Danışman',
    "label2" TEXT NOT NULL DEFAULT 'Hedef',
    "label3" TEXT NOT NULL DEFAULT 'Gerçekleşen',
    "createdById" TEXT NOT NULL,
    "status" "ProjectPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "consultant" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 0,
    "actual" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAnalysis" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "revision" TEXT NOT NULL DEFAULT 'Rev.00',
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "revisionNote" TEXT,
    "revisionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentId" TEXT,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "finishedWeight" DECIMAL(10,2) NOT NULL,
    "currency" "CostCurrency" NOT NULL DEFAULT 'EUR',
    "categoryId" TEXT,
    "customerId" TEXT,
    "materialCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "externalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overheadRate" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "overheadAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profitRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "profitAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salesPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pricePerKg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "CostAnalysisStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostMaterial" (
    "id" TEXT NOT NULL,
    "costAnalysisId" TEXT NOT NULL,
    "materialCode" TEXT,
    "name" TEXT NOT NULL,
    "specification" TEXT,
    "category" "MaterialCostCategory" NOT NULL DEFAULT 'RAW_MATERIAL',
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "currency" "CostCurrency" NOT NULL DEFAULT 'EUR',
    "grossQuantity" DECIMAL(10,3) NOT NULL,
    "wasteRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "netQuantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "supplierId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostMaterialCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specification" TEXT,
    "category" "MaterialCostCategory" NOT NULL DEFAULT 'RAW_MATERIAL',
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "currency" "CostCurrency" NOT NULL DEFAULT 'EUR',
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "supplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostMaterialCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostLabor" (
    "id" TEXT NOT NULL,
    "costAnalysisId" TEXT NOT NULL,
    "operationCode" TEXT,
    "operationName" TEXT NOT NULL,
    "workCenter" TEXT,
    "laborType" "CostLaborType" NOT NULL DEFAULT 'INTERNAL',
    "setupTime" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "processTime" DECIMAL(6,2) NOT NULL,
    "totalTime" DECIMAL(6,2) NOT NULL,
    "hourlyRate" DECIMAL(8,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "machineId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostLabor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostExternalService" (
    "id" TEXT NOT NULL,
    "costAnalysisId" TEXT NOT NULL,
    "serviceCode" TEXT,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" "CostServiceType" NOT NULL DEFAULT 'PROCESSING',
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "supplierId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostExternalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostOtherItem" (
    "id" TEXT NOT NULL,
    "costAnalysisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "OtherCostCategory" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostOtherItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCustomer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostSupplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CostSupplierType" NOT NULL DEFAULT 'MATERIAL',
    "country" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostMachine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT,
    "hourlyRate" DECIMAL(8,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" "CostCurrency" NOT NULL,
    "toCurrency" "CostCurrency" NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAnalysisVersion" (
    "id" TEXT NOT NULL,
    "costAnalysisId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostAnalysisVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQ" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FAQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FAQFeedback" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "helpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FAQFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "type" "CalendarEventType" NOT NULL DEFAULT 'OTHER',
    "color" TEXT,
    "location" TEXT,
    "createdById" TEXT NOT NULL,
    "departmentId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "remindBefore" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeForm" (
    "id" TEXT NOT NULL,
    "formNo" TEXT NOT NULL,
    "overtimeType" "OvertimeType" NOT NULL,
    "date" DATE NOT NULL,
    "isFullDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "OvertimeStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "sendToGM" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimePersonnel" (
    "id" TEXT NOT NULL,
    "overtimeFormId" TEXT NOT NULL,
    "personnelId" TEXT,
    "userId" TEXT,
    "workDepartment" TEXT NOT NULL,
    "serviceRoute" TEXT,
    "targetProduction" TEXT,
    "actualProduction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimePersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeApproval" (
    "id" TEXT NOT NULL,
    "overtimeFormId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "approverId" TEXT,
    "decision" "ApprovalDecision",
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "forwardToGM" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalPosition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "userId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeAuthorizedUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeAuthorizedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001PenetrationTest" (
    "id" TEXT NOT NULL,
    "testNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "testDate" TIMESTAMP(3) NOT NULL,
    "testType" "Iso27001PenTestType" NOT NULL,
    "scope" TEXT,
    "methodology" TEXT,
    "tester" TEXT NOT NULL,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "infoCount" INTEGER NOT NULL DEFAULT 0,
    "reportFileName" TEXT,
    "reportFileUrl" TEXT,
    "reportFileSize" INTEGER,
    "contentHash" TEXT,
    "status" "Iso27001PenTestStatus" NOT NULL DEFAULT 'PLANNED',
    "conductedById" TEXT,
    "conductedByName" TEXT,
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001PenetrationTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001PenTestFinding" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "findingNumber" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "impact" TEXT,
    "recommendation" TEXT,
    "responsiblePerson" TEXT,
    "deadline" TIMESTAMP(3),
    "actionStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "actionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Iso27001PenTestFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iso27001PenTestSignature" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signerTitle" TEXT,
    "signerDepartment" TEXT,
    "signatureCode" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "testHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signatureType" "Iso27001SignatureType" NOT NULL DEFAULT 'APPROVAL',
    "notes" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Iso27001PenTestSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "taxNumber" TEXT,
    "serviceType" "SupplierServiceType" NOT NULL,
    "group" "SupplierGroup" NOT NULL DEFAULT 'PENDING',
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastScore" INTEGER,
    "lastEvalDate" TIMESTAMP(3),
    "hasNDA" BOOLEAN NOT NULL DEFAULT false,
    "ndaDate" TIMESTAMP(3),
    "ndaExpiry" TIMESTAMP(3),
    "hasDataAccess" BOOLEAN NOT NULL DEFAULT false,
    "bgRiskLevel" "SupplierBGRisk",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierEvaluation" (
    "id" TEXT NOT NULL,
    "evaluationNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "evaluationDate" TIMESTAMP(3) NOT NULL,
    "evaluationType" "EvaluationType" NOT NULL DEFAULT 'SERVICE',
    "period" TEXT,
    "totalScore" INTEGER NOT NULL,
    "resultGroup" "SupplierGroup" NOT NULL,
    "isApproved" BOOLEAN NOT NULL,
    "evaluatorName" TEXT NOT NULL,
    "evaluatorTitle" TEXT,
    "generalNotes" TEXT,
    "improvements" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "SupplierEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCriteriaScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "SupplierCriteriaScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierCriteria" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL,
    "evaluationType" "EvaluationType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SupplierCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "sicilNo" TEXT NOT NULL,
    "sinif" TEXT,
    "cinsiyet" "Gender" NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "yakaRengi" "YakaRengi" NOT NULL,
    "direktEndirekt" "DirektEndirekt",
    "asansorMekanik" "AsansorMekanik",
    "iseGirisTarihi" DATE NOT NULL,
    "gorev" TEXT NOT NULL,
    "bolumDetay" TEXT,
    "bolum" TEXT NOT NULL,
    "birimSorumlusu" TEXT,
    "sorumlu2" TEXT,
    "sorumlu3" TEXT,
    "bolumMuduru" TEXT,
    "masrafMerkezi" TEXT,
    "interKepMail" TEXT,
    "ikametAdresi" TEXT,
    "serviceRoute" TEXT,
    "serviceStop" TEXT,
    "denemeDegerlendirme" DATE,
    "altiAyDegerlendirme" DATE,
    "telefon" TEXT,
    "kanGrubu" "BloodType",
    "mailAdresi" TEXT,
    "egitimYeri" TEXT,
    "egitimTipi" TEXT,
    "egitimAlani" TEXT,
    "mezuniyetYili" INTEGER,
    "ilkYardimciBelgesi" DATE,
    "kalfalikBelgesi" DATE,
    "ustalikBelgesi" DATE,
    "yanginSertifikasi" DATE,
    "mykBelgesiTarihi" DATE,
    "forkliftEhliyeti" BOOLEAN NOT NULL DEFAULT false,
    "vincEhliyeti" BOOLEAN NOT NULL DEFAULT false,
    "eTrans" BOOLEAN NOT NULL DEFAULT false,
    "ustaOgreticiBelgesi" BOOLEAN NOT NULL DEFAULT false,
    "emekli" BOOLEAN NOT NULL DEFAULT false,
    "engelli" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "azureAdId" TEXT,
    "azureAdEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelEvaluationEmailLog" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientEmails" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonnelEvaluationEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelSensitive" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "tcKimlikNo" TEXT,
    "sgkNo" TEXT,
    "dogumTarihi" DATE,
    "bankaSube" TEXT,
    "bankaHesapNo" TEXT,
    "ibanNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PersonnelSensitive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelAccessLog" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "accessedBy" TEXT NOT NULL,
    "accessType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonnelAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTitle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intern" (
    "id" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT,
    "bolum" TEXT NOT NULL,
    "stajSorumlusu" TEXT,
    "baslangicTarihi" DATE,
    "bitisTarihi" DATE,
    "okul" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultant" (
    "id" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "bolum" TEXT,
    "uzmanlikAlani" TEXT,
    "sozlesmeBaslangic" DATE,
    "sozlesmeBitis" DATE,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "category" TEXT,
    "difficulty" "CourseDifficulty" NOT NULL DEFAULT 'BEGINNER',
    "duration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ContentType" NOT NULL,
    "filePath" TEXT,
    "fileUrl" TEXT,
    "duration" INTEGER,
    "fileSize" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_packages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "courseId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_assignments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_packages" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_course_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "user_course_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_package_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_package_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "watchedSeconds" INTEGER,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "timeLimit" INTEGER,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_exam_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "user_exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_exam_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT,
    "textAnswer" TEXT,

    CONSTRAINT "user_exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akademi_certificates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "certificateNo" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT,
    "templateId" TEXT,

    CONSTRAINT "akademi_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akademi_certificate_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "akademi_certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akademi_certificate_downloads" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "akademi_certificate_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akademi_certificate_verifications" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "akademi_certificate_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "condition" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_xp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_xp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akademi_levels" (
    "id" SERIAL NOT NULL,
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "minXp" INTEGER NOT NULL,
    "maxXp" INTEGER,
    "badgeUrl" TEXT,

    CONSTRAINT "akademi_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_challenges" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "xpReward" INTEGER NOT NULL DEFAULT 50,
    "date" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_daily_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_daily_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "akademi_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "akademi_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CapaDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CapaDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AuditFindingDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AuditFindingDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ChangeRequestDocuments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ChangeRequestDocuments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_azureAdId_key" ON "User"("azureAdId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_personnelId_key" ON "User"("personnelId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_adOuName_key" ON "Department"("adOuName");

-- CreateIndex
CREATE INDEX "Department_isActive_sortOrder_idx" ON "Department"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationLocation_name_key" ON "CalibrationLocation"("name");

-- CreateIndex
CREATE INDEX "CalibrationLocation_isActive_sortOrder_idx" ON "CalibrationLocation"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationProductionSection_name_key" ON "CalibrationProductionSection"("name");

-- CreateIndex
CREATE INDEX "CalibrationProductionSection_isActive_sortOrder_idx" ON "CalibrationProductionSection"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDeviceType_name_key" ON "CalibrationDeviceType"("name");

-- CreateIndex
CREATE INDEX "CalibrationDeviceType_isActive_sortOrder_idx" ON "CalibrationDeviceType"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDeviceModel_name_key" ON "CalibrationDeviceModel"("name");

-- CreateIndex
CREATE INDEX "CalibrationDeviceModel_isActive_sortOrder_idx" ON "CalibrationDeviceModel"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CalibrationDeviceModel_manufacturer_idx" ON "CalibrationDeviceModel"("manufacturer");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDeviceName_name_key" ON "CalibrationDeviceName"("name");

-- CreateIndex
CREATE INDEX "CalibrationDeviceName_isActive_sortOrder_idx" ON "CalibrationDeviceName"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDepartment_name_key" ON "CalibrationDepartment"("name");

-- CreateIndex
CREATE INDEX "CalibrationDepartment_isActive_sortOrder_idx" ON "CalibrationDepartment"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationDevice_deviceId_key" ON "CalibrationDevice"("deviceId");

-- CreateIndex
CREATE INDEX "CalibrationDevice_status_idx" ON "CalibrationDevice"("status");

-- CreateIndex
CREATE INDEX "CalibrationDevice_nextCalibrationDate_idx" ON "CalibrationDevice"("nextCalibrationDate");

-- CreateIndex
CREATE INDEX "CalibrationHistory_deviceId_idx" ON "CalibrationHistory"("deviceId");

-- CreateIndex
CREATE INDEX "CalibrationHistory_calibrationDate_idx" ON "CalibrationHistory"("calibrationDate");

-- CreateIndex
CREATE INDEX "CalibrationEmailLog_deviceId_idx" ON "CalibrationEmailLog"("deviceId");

-- CreateIndex
CREATE INDEX "CalibrationEmailLog_recipientId_idx" ON "CalibrationEmailLog"("recipientId");

-- CreateIndex
CREATE INDEX "CalibrationEmailLog_sentAt_idx" ON "CalibrationEmailLog"("sentAt");

-- CreateIndex
CREATE INDEX "CalibrationNotificationEmail_isActive_idx" ON "CalibrationNotificationEmail"("isActive");

-- CreateIndex
CREATE INDEX "CalibrationNotificationEmail_category_idx" ON "CalibrationNotificationEmail"("category");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationNotificationEmail_email_category_key" ON "CalibrationNotificationEmail"("email", "category");

-- CreateIndex
CREATE INDEX "CalibrationNotificationRule_isActive_idx" ON "CalibrationNotificationRule"("isActive");

-- CreateIndex
CREATE INDEX "CalibrationNotificationRule_type_idx" ON "CalibrationNotificationRule"("type");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCategory_name_key" ON "TaskCategory"("name");

-- CreateIndex
CREATE INDEX "TaskCategory_isActive_sortOrder_idx" ON "TaskCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PlannedTask_status_idx" ON "PlannedTask"("status");

-- CreateIndex
CREATE INDEX "PlannedTask_parentTaskId_idx" ON "PlannedTask"("parentTaskId");

-- CreateIndex
CREATE INDEX "PlannedTask_dueDate_idx" ON "PlannedTask"("dueDate");

-- CreateIndex
CREATE INDEX "PlannedTask_categoryId_idx" ON "PlannedTask"("categoryId");

-- CreateIndex
CREATE INDEX "PlannedTask_priority_idx" ON "PlannedTask"("priority");

-- CreateIndex
CREATE INDEX "TaskEmailLog_taskId_idx" ON "TaskEmailLog"("taskId");

-- CreateIndex
CREATE INDEX "TaskEmailLog_sentAt_idx" ON "TaskEmailLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskNotificationEmail_email_key" ON "TaskNotificationEmail"("email");

-- CreateIndex
CREATE INDEX "TaskNotificationEmail_isActive_idx" ON "TaskNotificationEmail"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TaskExecutiveEmail_email_key" ON "TaskExecutiveEmail"("email");

-- CreateIndex
CREATE INDEX "TaskExecutiveEmail_isActive_idx" ON "TaskExecutiveEmail"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionCategory_name_key" ON "SuggestionCategory"("name");

-- CreateIndex
CREATE INDEX "SuggestionCategory_isActive_sortOrder_idx" ON "SuggestionCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_suggestionNumber_key" ON "Suggestion"("suggestionNumber");

-- CreateIndex
CREATE INDEX "Suggestion_status_idx" ON "Suggestion"("status");

-- CreateIndex
CREATE INDEX "Suggestion_categoryId_idx" ON "Suggestion"("categoryId");

-- CreateIndex
CREATE INDEX "Suggestion_submittedBy_idx" ON "Suggestion"("submittedBy");

-- CreateIndex
CREATE INDEX "Suggestion_priority_idx" ON "Suggestion"("priority");

-- CreateIndex
CREATE INDEX "Suggestion_submittedAt_idx" ON "Suggestion"("submittedAt");

-- CreateIndex
CREATE INDEX "Suggestion_suggestionNumber_idx" ON "Suggestion"("suggestionNumber");

-- CreateIndex
CREATE INDEX "SuggestionApproval_suggestionId_idx" ON "SuggestionApproval"("suggestionId");

-- CreateIndex
CREATE INDEX "SuggestionApproval_approverEmail_idx" ON "SuggestionApproval"("approverEmail");

-- CreateIndex
CREATE INDEX "SuggestionComment_suggestionId_idx" ON "SuggestionComment"("suggestionId");

-- CreateIndex
CREATE INDEX "SuggestionTimeline_suggestionId_idx" ON "SuggestionTimeline"("suggestionId");

-- CreateIndex
CREATE INDEX "SuggestionTimeline_createdAt_idx" ON "SuggestionTimeline"("createdAt");

-- CreateIndex
CREATE INDEX "SuggestionEvaluator_categoryId_idx" ON "SuggestionEvaluator"("categoryId");

-- CreateIndex
CREATE INDEX "SuggestionEvaluator_department_idx" ON "SuggestionEvaluator"("department");

-- CreateIndex
CREATE INDEX "SuggestionEvaluator_isActive_idx" ON "SuggestionEvaluator"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionBoardMember_email_key" ON "SuggestionBoardMember"("email");

-- CreateIndex
CREATE INDEX "SuggestionBoardMember_isActive_idx" ON "SuggestionBoardMember"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KaizenProject_projectNumber_key" ON "KaizenProject"("projectNumber");

-- CreateIndex
CREATE INDEX "KaizenProject_status_idx" ON "KaizenProject"("status");

-- CreateIndex
CREATE INDEX "KaizenProject_pdcaStage_idx" ON "KaizenProject"("pdcaStage");

-- CreateIndex
CREATE INDEX "KaizenProject_projectNumber_idx" ON "KaizenProject"("projectNumber");

-- CreateIndex
CREATE INDEX "KaizenProject_departmentId_idx" ON "KaizenProject"("departmentId");

-- CreateIndex
CREATE INDEX "KaizenTeamMember_projectId_idx" ON "KaizenTeamMember"("projectId");

-- CreateIndex
CREATE INDEX "KaizenTeamMember_email_idx" ON "KaizenTeamMember"("email");

-- CreateIndex
CREATE INDEX "KaizenPDCAStep_projectId_idx" ON "KaizenPDCAStep"("projectId");

-- CreateIndex
CREATE INDEX "KaizenPDCAStep_stage_idx" ON "KaizenPDCAStep"("stage");

-- CreateIndex
CREATE INDEX "KaizenAttachment_projectId_idx" ON "KaizenAttachment"("projectId");

-- CreateIndex
CREATE INDEX "KaizenTimeline_projectId_idx" ON "KaizenTimeline"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "NearMiss_reportNumber_key" ON "NearMiss"("reportNumber");

-- CreateIndex
CREATE INDEX "NearMiss_status_idx" ON "NearMiss"("status");

-- CreateIndex
CREATE INDEX "NearMiss_eventType_idx" ON "NearMiss"("eventType");

-- CreateIndex
CREATE INDEX "NearMiss_reportNumber_idx" ON "NearMiss"("reportNumber");

-- CreateIndex
CREATE INDEX "NearMiss_reportedAt_idx" ON "NearMiss"("reportedAt");

-- CreateIndex
CREATE INDEX "NearMiss_potentialSeverity_idx" ON "NearMiss"("potentialSeverity");

-- CreateIndex
CREATE INDEX "NearMissAttachment_nearMissId_idx" ON "NearMissAttachment"("nearMissId");

-- CreateIndex
CREATE INDEX "NearMissAction_nearMissId_idx" ON "NearMissAction"("nearMissId");

-- CreateIndex
CREATE INDEX "NearMissAction_status_idx" ON "NearMissAction"("status");

-- CreateIndex
CREATE INDEX "NearMissTimeline_nearMissId_idx" ON "NearMissTimeline"("nearMissId");

-- CreateIndex
CREATE UNIQUE INDEX "FiveSArea_code_key" ON "FiveSArea"("code");

-- CreateIndex
CREATE INDEX "FiveSArea_department_idx" ON "FiveSArea"("department");

-- CreateIndex
CREATE INDEX "FiveSArea_isActive_idx" ON "FiveSArea"("isActive");

-- CreateIndex
CREATE INDEX "FiveSTemplate_isActive_idx" ON "FiveSTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FiveSAudit_auditNumber_key" ON "FiveSAudit"("auditNumber");

-- CreateIndex
CREATE INDEX "FiveSAudit_areaId_idx" ON "FiveSAudit"("areaId");

-- CreateIndex
CREATE INDEX "FiveSAudit_auditDate_idx" ON "FiveSAudit"("auditDate");

-- CreateIndex
CREATE INDEX "FiveSAudit_status_idx" ON "FiveSAudit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FiveSFinding_plannedTaskId_key" ON "FiveSFinding"("plannedTaskId");

-- CreateIndex
CREATE INDEX "FiveSFinding_auditId_idx" ON "FiveSFinding"("auditId");

-- CreateIndex
CREATE INDEX "FiveSFinding_sCategory_idx" ON "FiveSFinding"("sCategory");

-- CreateIndex
CREATE INDEX "FiveSFinding_status_idx" ON "FiveSFinding"("status");

-- CreateIndex
CREATE INDEX "FiveSPhoto_auditId_idx" ON "FiveSPhoto"("auditId");

-- CreateIndex
CREATE INDEX "FiveSSchedule_areaId_idx" ON "FiveSSchedule"("areaId");

-- CreateIndex
CREATE INDEX "FiveSSchedule_nextAuditDate_idx" ON "FiveSSchedule"("nextAuditDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePoints_email_key" ON "EmployeePoints"("email");

-- CreateIndex
CREATE INDEX "EmployeePoints_totalPoints_idx" ON "EmployeePoints"("totalPoints");

-- CreateIndex
CREATE INDEX "EmployeePoints_department_idx" ON "EmployeePoints"("department");

-- CreateIndex
CREATE INDEX "PointHistory_employeePointsId_idx" ON "PointHistory"("employeePointsId");

-- CreateIndex
CREATE INDEX "PointHistory_category_idx" ON "PointHistory"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "Badge"("code");

-- CreateIndex
CREATE INDEX "Badge_category_idx" ON "Badge"("category");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementCategory_name_key" ON "AnnouncementCategory"("name");

-- CreateIndex
CREATE INDEX "AnnouncementCategory_isActive_sortOrder_idx" ON "AnnouncementCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Announcement_status_idx" ON "Announcement"("status");

-- CreateIndex
CREATE INDEX "Announcement_categoryId_idx" ON "Announcement"("categoryId");

-- CreateIndex
CREATE INDEX "Announcement_priority_idx" ON "Announcement"("priority");

-- CreateIndex
CREATE INDEX "Announcement_publishAt_idx" ON "Announcement"("publishAt");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "Announcement_isPinned_idx" ON "Announcement"("isPinned");

-- CreateIndex
CREATE INDEX "AnnouncementRead_announcementId_idx" ON "AnnouncementRead"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementRead_userEmail_idx" ON "AnnouncementRead"("userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userEmail_key" ON "AnnouncementRead"("announcementId", "userEmail");

-- CreateIndex
CREATE INDEX "AnnouncementComment_announcementId_idx" ON "AnnouncementComment"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementComment_parentId_idx" ON "AnnouncementComment"("parentId");

-- CreateIndex
CREATE INDEX "AnnouncementReaction_announcementId_idx" ON "AnnouncementReaction"("announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementReaction_announcementId_userEmail_reactionType_key" ON "AnnouncementReaction"("announcementId", "userEmail", "reactionType");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_surveyNumber_key" ON "Survey"("surveyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Survey_publicSlug_key" ON "Survey"("publicSlug");

-- CreateIndex
CREATE INDEX "Survey_status_idx" ON "Survey"("status");

-- CreateIndex
CREATE INDEX "Survey_endsAt_idx" ON "Survey"("endsAt");

-- CreateIndex
CREATE INDEX "Survey_isPublic_idx" ON "Survey"("isPublic");

-- CreateIndex
CREATE INDEX "Survey_publicSlug_idx" ON "Survey"("publicSlug");

-- CreateIndex
CREATE INDEX "SurveyQuestion_surveyId_idx" ON "SurveyQuestion"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyQuestion_sortOrder_idx" ON "SurveyQuestion"("sortOrder");

-- CreateIndex
CREATE INDEX "SurveyOption_questionId_idx" ON "SurveyOption"("questionId");

-- CreateIndex
CREATE INDEX "SurveyOption_sortOrder_idx" ON "SurveyOption"("sortOrder");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_idx" ON "SurveyResponse"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyResponse_respondentEmail_idx" ON "SurveyResponse"("respondentEmail");

-- CreateIndex
CREATE INDEX "SurveyResponse_isComplete_idx" ON "SurveyResponse"("isComplete");

-- CreateIndex
CREATE INDEX "SurveyAnswer_responseId_idx" ON "SurveyAnswer"("responseId");

-- CreateIndex
CREATE INDEX "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");

-- CreateIndex
CREATE INDEX "SurveyAnswer_optionId_idx" ON "SurveyAnswer"("optionId");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userEmail_idx" ON "ConversationParticipant"("userEmail");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userEmail_key" ON "ConversationParticipant"("conversationId", "userEmail");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_senderEmail_idx" ON "Message"("senderEmail");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "MessageReadReceipt_messageId_idx" ON "MessageReadReceipt"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReadReceipt_messageId_userEmail_key" ON "MessageReadReceipt"("messageId", "userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TicketCategory_name_key" ON "TicketCategory"("name");

-- CreateIndex
CREATE INDEX "TicketCategory_isActive_sortOrder_idx" ON "TicketCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "TicketCategory_parentId_idx" ON "TicketCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTeam_name_key" ON "TicketTeam"("name");

-- CreateIndex
CREATE INDEX "TicketTeam_isActive_idx" ON "TicketTeam"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_ticketNumber_idx" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE INDEX "Ticket_requesterEmail_idx" ON "Ticket"("requesterEmail");

-- CreateIndex
CREATE INDEX "Ticket_assignedTo_idx" ON "Ticket"("assignedTo");

-- CreateIndex
CREATE INDEX "Ticket_categoryId_idx" ON "Ticket"("categoryId");

-- CreateIndex
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "Ticket_slaResolutionDue_idx" ON "Ticket"("slaResolutionDue");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketComment_createdAt_idx" ON "TicketComment"("createdAt");

-- CreateIndex
CREATE INDEX "TicketTimeline_ticketId_idx" ON "TicketTimeline"("ticketId");

-- CreateIndex
CREATE INDEX "TicketTimeline_createdAt_idx" ON "TicketTimeline"("createdAt");

-- CreateIndex
CREATE INDEX "TicketWorkLog_ticketId_idx" ON "TicketWorkLog"("ticketId");

-- CreateIndex
CREATE INDEX "TicketWorkLog_technicianEmail_idx" ON "TicketWorkLog"("technicianEmail");

-- CreateIndex
CREATE UNIQUE INDEX "SLAPolicy_name_key" ON "SLAPolicy"("name");

-- CreateIndex
CREATE INDEX "SLAPolicy_isActive_idx" ON "SLAPolicy"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_articleNumber_key" ON "KnowledgeArticle"("articleNumber");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_status_idx" ON "KnowledgeArticle"("status");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_categoryId_idx" ON "KnowledgeArticle"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machineCode_key" ON "Machine"("machineCode");

-- CreateIndex
CREATE INDEX "Machine_status_idx" ON "Machine"("status");

-- CreateIndex
CREATE INDEX "Machine_machineCode_idx" ON "Machine"("machineCode");

-- CreateIndex
CREATE INDEX "Machine_machineType_idx" ON "Machine"("machineType");

-- CreateIndex
CREATE INDEX "Machine_department_idx" ON "Machine"("department");

-- CreateIndex
CREATE INDEX "Machine_criticalityLevel_idx" ON "Machine"("criticalityLevel");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenancePlan_planCode_key" ON "MaintenancePlan"("planCode");

-- CreateIndex
CREATE INDEX "MaintenancePlan_machineId_idx" ON "MaintenancePlan"("machineId");

-- CreateIndex
CREATE INDEX "MaintenancePlan_nextDueAt_idx" ON "MaintenancePlan"("nextDueAt");

-- CreateIndex
CREATE INDEX "MaintenancePlan_maintenanceType_idx" ON "MaintenancePlan"("maintenanceType");

-- CreateIndex
CREATE INDEX "MaintenancePlan_status_idx" ON "MaintenancePlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_workOrderNumber_key" ON "MaintenanceWorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_machineId_idx" ON "MaintenanceWorkOrder"("machineId");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_status_idx" ON "MaintenanceWorkOrder"("status");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_workOrderType_idx" ON "MaintenanceWorkOrder"("workOrderType");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_priority_idx" ON "MaintenanceWorkOrder"("priority");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_workOrderNumber_idx" ON "MaintenanceWorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_assignedTo_idx" ON "MaintenanceWorkOrder"("assignedTo");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_scheduledStartAt_idx" ON "MaintenanceWorkOrder"("scheduledStartAt");

-- CreateIndex
CREATE INDEX "DowntimeRecord_machineId_idx" ON "DowntimeRecord"("machineId");

-- CreateIndex
CREATE INDEX "DowntimeRecord_workOrderId_idx" ON "DowntimeRecord"("workOrderId");

-- CreateIndex
CREATE INDEX "DowntimeRecord_startTime_idx" ON "DowntimeRecord"("startTime");

-- CreateIndex
CREATE INDEX "DowntimeRecord_downtimeType_idx" ON "DowntimeRecord"("downtimeType");

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_partCode_key" ON "SparePart"("partCode");

-- CreateIndex
CREATE INDEX "SparePart_partCode_idx" ON "SparePart"("partCode");

-- CreateIndex
CREATE INDEX "SparePart_category_idx" ON "SparePart"("category");

-- CreateIndex
CREATE INDEX "SparePart_stockQuantity_idx" ON "SparePart"("stockQuantity");

-- CreateIndex
CREATE INDEX "MachineSparePartUsage_machineId_idx" ON "MachineSparePartUsage"("machineId");

-- CreateIndex
CREATE INDEX "MachineSparePartUsage_workOrderId_idx" ON "MachineSparePartUsage"("workOrderId");

-- CreateIndex
CREATE INDEX "MachineSparePartUsage_sparePartId_idx" ON "MachineSparePartUsage"("sparePartId");

-- CreateIndex
CREATE INDEX "MachineSparePartUsage_usedAt_idx" ON "MachineSparePartUsage"("usedAt");

-- CreateIndex
CREATE INDEX "MaintenanceLaborLog_workOrderId_idx" ON "MaintenanceLaborLog"("workOrderId");

-- CreateIndex
CREATE INDEX "MaintenanceLaborLog_technicianEmail_idx" ON "MaintenanceLaborLog"("technicianEmail");

-- CreateIndex
CREATE INDEX "MaintenanceTimeline_workOrderId_idx" ON "MaintenanceTimeline"("workOrderId");

-- CreateIndex
CREATE INDEX "MaintenanceTimeline_createdAt_idx" ON "MaintenanceTimeline"("createdAt");

-- CreateIndex
CREATE INDEX "MachineDocument_machineId_idx" ON "MachineDocument"("machineId");

-- CreateIndex
CREATE INDEX "MachineDocument_documentType_idx" ON "MachineDocument"("documentType");

-- CreateIndex
CREATE INDEX "MachineOEERecord_machineId_idx" ON "MachineOEERecord"("machineId");

-- CreateIndex
CREATE INDEX "MachineOEERecord_recordDate_idx" ON "MachineOEERecord"("recordDate");

-- CreateIndex
CREATE UNIQUE INDEX "MachineOEERecord_machineId_recordDate_shift_key" ON "MachineOEERecord"("machineId", "recordDate", "shift");

-- CreateIndex
CREATE INDEX "MaintenanceKPITarget_year_idx" ON "MaintenanceKPITarget"("year");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceKPITarget_year_month_key" ON "MaintenanceKPITarget"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsDocument_documentNumber_key" ON "QdmsDocument"("documentNumber");

-- CreateIndex
CREATE INDEX "QdmsDocument_documentNumber_idx" ON "QdmsDocument"("documentNumber");

-- CreateIndex
CREATE INDEX "QdmsDocument_category_idx" ON "QdmsDocument"("category");

-- CreateIndex
CREATE INDEX "QdmsDocument_status_idx" ON "QdmsDocument"("status");

-- CreateIndex
CREATE INDEX "QdmsDocument_departmentId_idx" ON "QdmsDocument"("departmentId");

-- CreateIndex
CREATE INDEX "QdmsDocument_ownerId_idx" ON "QdmsDocument"("ownerId");

-- CreateIndex
CREATE INDEX "QdmsDocumentRevision_documentId_idx" ON "QdmsDocumentRevision"("documentId");

-- CreateIndex
CREATE INDEX "QdmsDocumentRevision_version_idx" ON "QdmsDocumentRevision"("version");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsDocumentApproval_verificationCode_key" ON "QdmsDocumentApproval"("verificationCode");

-- CreateIndex
CREATE INDEX "QdmsDocumentApproval_documentId_idx" ON "QdmsDocumentApproval"("documentId");

-- CreateIndex
CREATE INDEX "QdmsDocumentApproval_approverId_idx" ON "QdmsDocumentApproval"("approverId");

-- CreateIndex
CREATE INDEX "QdmsDocumentApproval_status_idx" ON "QdmsDocumentApproval"("status");

-- CreateIndex
CREATE INDEX "QdmsDocumentApproval_verificationCode_idx" ON "QdmsDocumentApproval"("verificationCode");

-- CreateIndex
CREATE INDEX "QdmsDocumentDistribution_documentId_idx" ON "QdmsDocumentDistribution"("documentId");

-- CreateIndex
CREATE INDEX "QdmsDocumentDistribution_userId_idx" ON "QdmsDocumentDistribution"("userId");

-- CreateIndex
CREATE INDEX "QdmsDocumentDistribution_departmentId_idx" ON "QdmsDocumentDistribution"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsCapa_capaNumber_key" ON "QdmsCapa"("capaNumber");

-- CreateIndex
CREATE INDEX "QdmsCapa_capaNumber_idx" ON "QdmsCapa"("capaNumber");

-- CreateIndex
CREATE INDEX "QdmsCapa_status_idx" ON "QdmsCapa"("status");

-- CreateIndex
CREATE INDEX "QdmsCapa_type_idx" ON "QdmsCapa"("type");

-- CreateIndex
CREATE INDEX "QdmsCapa_priority_idx" ON "QdmsCapa"("priority");

-- CreateIndex
CREATE INDEX "QdmsCapa_departmentId_idx" ON "QdmsCapa"("departmentId");

-- CreateIndex
CREATE INDEX "QdmsCapa_responsibleId_idx" ON "QdmsCapa"("responsibleId");

-- CreateIndex
CREATE INDEX "QdmsCapaAction_capaId_idx" ON "QdmsCapaAction"("capaId");

-- CreateIndex
CREATE INDEX "QdmsCapaAction_responsibleId_idx" ON "QdmsCapaAction"("responsibleId");

-- CreateIndex
CREATE INDEX "QdmsCapaAction_status_idx" ON "QdmsCapaAction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsNonConformance_ncrNumber_key" ON "QdmsNonConformance"("ncrNumber");

-- CreateIndex
CREATE INDEX "QdmsNonConformance_ncrNumber_idx" ON "QdmsNonConformance"("ncrNumber");

-- CreateIndex
CREATE INDEX "QdmsNonConformance_level_idx" ON "QdmsNonConformance"("level");

-- CreateIndex
CREATE INDEX "QdmsNonConformance_status_idx" ON "QdmsNonConformance"("status");

-- CreateIndex
CREATE INDEX "QdmsNonConformance_departmentId_idx" ON "QdmsNonConformance"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsAudit_auditNumber_key" ON "QdmsAudit"("auditNumber");

-- CreateIndex
CREATE INDEX "QdmsAudit_auditNumber_idx" ON "QdmsAudit"("auditNumber");

-- CreateIndex
CREATE INDEX "QdmsAudit_type_idx" ON "QdmsAudit"("type");

-- CreateIndex
CREATE INDEX "QdmsAudit_status_idx" ON "QdmsAudit"("status");

-- CreateIndex
CREATE INDEX "QdmsAudit_departmentId_idx" ON "QdmsAudit"("departmentId");

-- CreateIndex
CREATE INDEX "QdmsAuditTeamMember_auditId_idx" ON "QdmsAuditTeamMember"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsAuditTeamMember_auditId_userId_key" ON "QdmsAuditTeamMember"("auditId", "userId");

-- CreateIndex
CREATE INDEX "QdmsAuditChecklist_auditId_idx" ON "QdmsAuditChecklist"("auditId");

-- CreateIndex
CREATE INDEX "QdmsAuditFinding_auditId_idx" ON "QdmsAuditFinding"("auditId");

-- CreateIndex
CREATE INDEX "QdmsAuditFinding_type_idx" ON "QdmsAuditFinding"("type");

-- CreateIndex
CREATE INDEX "QdmsAuditFinding_status_idx" ON "QdmsAuditFinding"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsRisk_riskNumber_key" ON "QdmsRisk"("riskNumber");

-- CreateIndex
CREATE INDEX "QdmsRisk_riskNumber_idx" ON "QdmsRisk"("riskNumber");

-- CreateIndex
CREATE INDEX "QdmsRisk_riskLevel_idx" ON "QdmsRisk"("riskLevel");

-- CreateIndex
CREATE INDEX "QdmsRisk_status_idx" ON "QdmsRisk"("status");

-- CreateIndex
CREATE INDEX "QdmsRisk_departmentId_idx" ON "QdmsRisk"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsSupplier_supplierCode_key" ON "QdmsSupplier"("supplierCode");

-- CreateIndex
CREATE INDEX "QdmsSupplier_supplierCode_idx" ON "QdmsSupplier"("supplierCode");

-- CreateIndex
CREATE INDEX "QdmsSupplier_status_idx" ON "QdmsSupplier"("status");

-- CreateIndex
CREATE INDEX "QdmsSupplier_rating_idx" ON "QdmsSupplier"("rating");

-- CreateIndex
CREATE INDEX "QdmsSupplierEvaluation_supplierId_idx" ON "QdmsSupplierEvaluation"("supplierId");

-- CreateIndex
CREATE INDEX "QdmsSupplierEvaluation_period_idx" ON "QdmsSupplierEvaluation"("period");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsChangeRequest_changeNumber_key" ON "QdmsChangeRequest"("changeNumber");

-- CreateIndex
CREATE INDEX "QdmsChangeRequest_changeNumber_idx" ON "QdmsChangeRequest"("changeNumber");

-- CreateIndex
CREATE INDEX "QdmsChangeRequest_status_idx" ON "QdmsChangeRequest"("status");

-- CreateIndex
CREATE INDEX "QdmsChangeRequest_type_idx" ON "QdmsChangeRequest"("type");

-- CreateIndex
CREATE INDEX "QdmsChangeRequest_departmentId_idx" ON "QdmsChangeRequest"("departmentId");

-- CreateIndex
CREATE INDEX "QdmsChangeRequestApproval_changeRequestId_idx" ON "QdmsChangeRequestApproval"("changeRequestId");

-- CreateIndex
CREATE INDEX "QdmsChangeRequestApproval_approverId_idx" ON "QdmsChangeRequestApproval"("approverId");

-- CreateIndex
CREATE INDEX "QdmsTrainingRecord_userId_idx" ON "QdmsTrainingRecord"("userId");

-- CreateIndex
CREATE INDEX "QdmsTrainingRecord_documentId_idx" ON "QdmsTrainingRecord"("documentId");

-- CreateIndex
CREATE INDEX "QdmsTrainingRecord_status_idx" ON "QdmsTrainingRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QdmsCustomerComplaint_complaintNumber_key" ON "QdmsCustomerComplaint"("complaintNumber");

-- CreateIndex
CREATE INDEX "QdmsCustomerComplaint_complaintNumber_idx" ON "QdmsCustomerComplaint"("complaintNumber");

-- CreateIndex
CREATE INDEX "QdmsCustomerComplaint_status_idx" ON "QdmsCustomerComplaint"("status");

-- CreateIndex
CREATE INDEX "QdmsCustomerComplaint_priority_idx" ON "QdmsCustomerComplaint"("priority");

-- CreateIndex
CREATE INDEX "QdmsCustomerComplaint_departmentId_idx" ON "QdmsCustomerComplaint"("departmentId");

-- CreateIndex
CREATE INDEX "BackupLog_status_idx" ON "BackupLog"("status");

-- CreateIndex
CREATE INDEX "BackupLog_projectName_idx" ON "BackupLog"("projectName");

-- CreateIndex
CREATE INDEX "BackupLog_backupType_idx" ON "BackupLog"("backupType");

-- CreateIndex
CREATE INDEX "BackupLog_createdAt_idx" ON "BackupLog"("createdAt");

-- CreateIndex
CREATE INDEX "BackupSchedule_isActive_idx" ON "BackupSchedule"("isActive");

-- CreateIndex
CREATE INDEX "BackupSchedule_nextRunAt_idx" ON "BackupSchedule"("nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMenu_date_key" ON "DailyMenu"("date");

-- CreateIndex
CREATE INDEX "DailyMenu_date_idx" ON "DailyMenu"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_code_key" ON "Competency"("code");

-- CreateIndex
CREATE INDEX "Competency_category_idx" ON "Competency"("category");

-- CreateIndex
CREATE INDEX "Competency_isActive_idx" ON "Competency"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Position_code_key" ON "Position"("code");

-- CreateIndex
CREATE INDEX "Position_department_idx" ON "Position"("department");

-- CreateIndex
CREATE INDEX "Position_level_idx" ON "Position"("level");

-- CreateIndex
CREATE INDEX "Position_isCritical_idx" ON "Position"("isCritical");

-- CreateIndex
CREATE INDEX "Position_source_idx" ON "Position"("source");

-- CreateIndex
CREATE INDEX "Position_adJobTitle_idx" ON "Position"("adJobTitle");

-- CreateIndex
CREATE INDEX "PositionCompetency_positionId_idx" ON "PositionCompetency"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "PositionCompetency_positionId_competencyId_key" ON "PositionCompetency"("positionId", "competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_userId_key" ON "TalentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentProfile_userEmail_key" ON "TalentProfile"("userEmail");

-- CreateIndex
CREATE INDEX "TalentProfile_department_idx" ON "TalentProfile"("department");

-- CreateIndex
CREATE INDEX "TalentProfile_performanceLevel_potentialLevel_idx" ON "TalentProfile"("performanceLevel", "potentialLevel");

-- CreateIndex
CREATE INDEX "TalentProfile_retentionRisk_idx" ON "TalentProfile"("retentionRisk");

-- CreateIndex
CREATE INDEX "TalentProfile_talentScore_idx" ON "TalentProfile"("talentScore");

-- CreateIndex
CREATE INDEX "EmployeeCompetency_talentProfileId_idx" ON "EmployeeCompetency"("talentProfileId");

-- CreateIndex
CREATE INDEX "EmployeeCompetency_gap_idx" ON "EmployeeCompetency"("gap");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeCompetency_talentProfileId_competencyId_key" ON "EmployeeCompetency"("talentProfileId", "competencyId");

-- CreateIndex
CREATE INDEX "SuccessionPlan_positionId_idx" ON "SuccessionPlan"("positionId");

-- CreateIndex
CREATE INDEX "SuccessionPlan_status_idx" ON "SuccessionPlan"("status");

-- CreateIndex
CREATE INDEX "SuccessionPlan_priority_idx" ON "SuccessionPlan"("priority");

-- CreateIndex
CREATE INDEX "SuccessionCandidate_successionPlanId_idx" ON "SuccessionCandidate"("successionPlanId");

-- CreateIndex
CREATE INDEX "SuccessionCandidate_readiness_idx" ON "SuccessionCandidate"("readiness");

-- CreateIndex
CREATE INDEX "CareerPath_talentProfileId_idx" ON "CareerPath"("talentProfileId");

-- CreateIndex
CREATE INDEX "CareerPath_targetPositionId_idx" ON "CareerPath"("targetPositionId");

-- CreateIndex
CREATE INDEX "CareerPath_status_idx" ON "CareerPath"("status");

-- CreateIndex
CREATE INDEX "DevelopmentPlan_talentProfileId_idx" ON "DevelopmentPlan"("talentProfileId");

-- CreateIndex
CREATE INDEX "DevelopmentPlan_status_idx" ON "DevelopmentPlan"("status");

-- CreateIndex
CREATE INDEX "DevelopmentGoal_developmentPlanId_idx" ON "DevelopmentGoal"("developmentPlanId");

-- CreateIndex
CREATE INDEX "DevelopmentGoal_status_idx" ON "DevelopmentGoal"("status");

-- CreateIndex
CREATE INDEX "MentorshipRelation_mentorId_idx" ON "MentorshipRelation"("mentorId");

-- CreateIndex
CREATE INDEX "MentorshipRelation_menteeId_idx" ON "MentorshipRelation"("menteeId");

-- CreateIndex
CREATE INDEX "MentorshipRelation_status_idx" ON "MentorshipRelation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MentorshipRelation_mentorId_menteeId_key" ON "MentorshipRelation"("mentorId", "menteeId");

-- CreateIndex
CREATE INDEX "TalentActivityLog_activityType_idx" ON "TalentActivityLog"("activityType");

-- CreateIndex
CREATE INDEX "TalentActivityLog_employeeEmail_idx" ON "TalentActivityLog"("employeeEmail");

-- CreateIndex
CREATE INDEX "TalentActivityLog_createdAt_idx" ON "TalentActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "PerformanceCycle_year_idx" ON "PerformanceCycle"("year");

-- CreateIndex
CREATE INDEX "PerformanceCycle_status_idx" ON "PerformanceCycle"("status");

-- CreateIndex
CREATE INDEX "PerformanceCycle_isActive_idx" ON "PerformanceCycle"("isActive");

-- CreateIndex
CREATE INDEX "PerformanceReview_cycleId_idx" ON "PerformanceReview"("cycleId");

-- CreateIndex
CREATE INDEX "PerformanceReview_employeeEmail_idx" ON "PerformanceReview"("employeeEmail");

-- CreateIndex
CREATE INDEX "PerformanceReview_managerId_idx" ON "PerformanceReview"("managerId");

-- CreateIndex
CREATE INDEX "PerformanceReview_status_idx" ON "PerformanceReview"("status");

-- CreateIndex
CREATE INDEX "PerformanceReview_overallRating_idx" ON "PerformanceReview"("overallRating");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceReview_cycleId_employeeId_key" ON "PerformanceReview"("cycleId", "employeeId");

-- CreateIndex
CREATE INDEX "PerformanceGoal_reviewId_idx" ON "PerformanceGoal"("reviewId");

-- CreateIndex
CREATE INDEX "PerformanceGoal_status_idx" ON "PerformanceGoal"("status");

-- CreateIndex
CREATE INDEX "FeedbackRequest_subjectEmail_idx" ON "FeedbackRequest"("subjectEmail");

-- CreateIndex
CREATE INDEX "FeedbackRequest_providerEmail_idx" ON "FeedbackRequest"("providerEmail");

-- CreateIndex
CREATE INDEX "FeedbackRequest_status_idx" ON "FeedbackRequest"("status");

-- CreateIndex
CREATE INDEX "FeedbackResponse_feedbackRequestId_idx" ON "FeedbackResponse"("feedbackRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelRequest_requestNumber_key" ON "PersonnelRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "PersonnelRequest_requesterId_idx" ON "PersonnelRequest"("requesterId");

-- CreateIndex
CREATE INDEX "PersonnelRequest_department_idx" ON "PersonnelRequest"("department");

-- CreateIndex
CREATE INDEX "PersonnelRequest_status_idx" ON "PersonnelRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JobOpening_code_key" ON "JobOpening"("code");

-- CreateIndex
CREATE INDEX "JobOpening_department_idx" ON "JobOpening"("department");

-- CreateIndex
CREATE INDEX "JobOpening_status_idx" ON "JobOpening"("status");

-- CreateIndex
CREATE INDEX "JobOpening_priority_idx" ON "JobOpening"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_email_key" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_source_idx" ON "Candidate"("source");

-- CreateIndex
CREATE INDEX "JobApplication_jobOpeningId_idx" ON "JobApplication"("jobOpeningId");

-- CreateIndex
CREATE INDEX "JobApplication_candidateId_idx" ON "JobApplication"("candidateId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobOpeningId_candidateId_key" ON "JobApplication"("jobOpeningId", "candidateId");

-- CreateIndex
CREATE INDEX "InterviewStage_jobOpeningId_idx" ON "InterviewStage"("jobOpeningId");

-- CreateIndex
CREATE INDEX "InterviewStage_order_idx" ON "InterviewStage"("order");

-- CreateIndex
CREATE INDEX "Interview_applicationId_idx" ON "Interview"("applicationId");

-- CreateIndex
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_code_key" ON "OrgUnit"("code");

-- CreateIndex
CREATE INDEX "OrgUnit_parentId_idx" ON "OrgUnit"("parentId");

-- CreateIndex
CREATE INDEX "OrgUnit_unitType_idx" ON "OrgUnit"("unitType");

-- CreateIndex
CREATE INDEX "OrgUnit_level_idx" ON "OrgUnit"("level");

-- CreateIndex
CREATE INDEX "OrgUnit_isActive_idx" ON "OrgUnit"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "OrgEmployee_userId_key" ON "OrgEmployee"("userId");

-- CreateIndex
CREATE INDEX "OrgEmployee_orgUnitId_idx" ON "OrgEmployee"("orgUnitId");

-- CreateIndex
CREATE INDEX "OrgEmployee_reportsToId_idx" ON "OrgEmployee"("reportsToId");

-- CreateIndex
CREATE INDEX "OrgEmployee_employmentStatus_idx" ON "OrgEmployee"("employmentStatus");

-- CreateIndex
CREATE INDEX "OrgEmployee_isActive_idx" ON "OrgEmployee"("isActive");

-- CreateIndex
CREATE INDEX "LoginLog_email_idx" ON "LoginLog"("email");

-- CreateIndex
CREATE INDEX "LoginLog_status_idx" ON "LoginLog"("status");

-- CreateIndex
CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicJobApplication_applicationNumber_key" ON "PublicJobApplication"("applicationNumber");

-- CreateIndex
CREATE INDEX "PublicJobApplication_status_idx" ON "PublicJobApplication"("status");

-- CreateIndex
CREATE INDEX "PublicJobApplication_createdAt_idx" ON "PublicJobApplication"("createdAt");

-- CreateIndex
CREATE INDEX "PublicJobApplication_applicationNumber_idx" ON "PublicJobApplication"("applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Document_documentNumber_key" ON "Iso27001Document"("documentNumber");

-- CreateIndex
CREATE INDEX "Iso27001Document_category_idx" ON "Iso27001Document"("category");

-- CreateIndex
CREATE INDEX "Iso27001Document_status_idx" ON "Iso27001Document"("status");

-- CreateIndex
CREATE INDEX "Iso27001Document_clause_idx" ON "Iso27001Document"("clause");

-- CreateIndex
CREATE INDEX "Iso27001Document_controlId_idx" ON "Iso27001Document"("controlId");

-- CreateIndex
CREATE INDEX "Iso27001Document_nextReviewDate_idx" ON "Iso27001Document"("nextReviewDate");

-- CreateIndex
CREATE INDEX "Iso27001DocumentVersion_documentId_idx" ON "Iso27001DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "Iso27001DocumentVersion_version_idx" ON "Iso27001DocumentVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Signature_signatureCode_key" ON "Iso27001Signature"("signatureCode");

-- CreateIndex
CREATE INDEX "Iso27001Signature_documentId_idx" ON "Iso27001Signature"("documentId");

-- CreateIndex
CREATE INDEX "Iso27001Signature_signerId_idx" ON "Iso27001Signature"("signerId");

-- CreateIndex
CREATE INDEX "Iso27001Signature_signatureCode_idx" ON "Iso27001Signature"("signatureCode");

-- CreateIndex
CREATE INDEX "Iso27001Signature_signedAt_idx" ON "Iso27001Signature"("signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Control_controlId_key" ON "Iso27001Control"("controlId");

-- CreateIndex
CREATE INDEX "Iso27001Control_category_idx" ON "Iso27001Control"("category");

-- CreateIndex
CREATE INDEX "Iso27001Control_status_idx" ON "Iso27001Control"("status");

-- CreateIndex
CREATE INDEX "Iso27001Control_applicability_idx" ON "Iso27001Control"("applicability");

-- CreateIndex
CREATE INDEX "Iso27001ControlDocument_controlId_idx" ON "Iso27001ControlDocument"("controlId");

-- CreateIndex
CREATE INDEX "Iso27001ControlDocument_documentId_idx" ON "Iso27001ControlDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001ControlDocument_controlId_documentId_key" ON "Iso27001ControlDocument"("controlId", "documentId");

-- CreateIndex
CREATE INDEX "Iso27001Evidence_controlId_idx" ON "Iso27001Evidence"("controlId");

-- CreateIndex
CREATE INDEX "Iso27001Evidence_evidenceType_idx" ON "Iso27001Evidence"("evidenceType");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001AuditProgram_programNumber_key" ON "Iso27001AuditProgram"("programNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001AuditProgram_year_key" ON "Iso27001AuditProgram"("year");

-- CreateIndex
CREATE INDEX "Iso27001AuditProgram_year_idx" ON "Iso27001AuditProgram"("year");

-- CreateIndex
CREATE INDEX "Iso27001AuditProgram_status_idx" ON "Iso27001AuditProgram"("status");

-- CreateIndex
CREATE INDEX "Iso27001AuditProgramAuditor_programId_idx" ON "Iso27001AuditProgramAuditor"("programId");

-- CreateIndex
CREATE INDEX "Iso27001AuditProgramItem_programId_idx" ON "Iso27001AuditProgramItem"("programId");

-- CreateIndex
CREATE INDEX "Iso27001AuditProgramItem_auditId_idx" ON "Iso27001AuditProgramItem"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Audit_auditNumber_key" ON "Iso27001Audit"("auditNumber");

-- CreateIndex
CREATE INDEX "Iso27001Audit_status_idx" ON "Iso27001Audit"("status");

-- CreateIndex
CREATE INDEX "Iso27001Audit_plannedDate_idx" ON "Iso27001Audit"("plannedDate");

-- CreateIndex
CREATE INDEX "Iso27001Audit_auditType_idx" ON "Iso27001Audit"("auditType");

-- CreateIndex
CREATE INDEX "Iso27001AuditTeamMember_auditId_idx" ON "Iso27001AuditTeamMember"("auditId");

-- CreateIndex
CREATE INDEX "Iso27001AuditFinding_auditId_idx" ON "Iso27001AuditFinding"("auditId");

-- CreateIndex
CREATE INDEX "Iso27001AuditFinding_controlId_idx" ON "Iso27001AuditFinding"("controlId");

-- CreateIndex
CREATE INDEX "Iso27001AuditFinding_status_idx" ON "Iso27001AuditFinding"("status");

-- CreateIndex
CREATE INDEX "Iso27001AuditFinding_findingType_idx" ON "Iso27001AuditFinding"("findingType");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Threat_code_key" ON "Iso27001Threat"("code");

-- CreateIndex
CREATE INDEX "Iso27001Threat_category_idx" ON "Iso27001Threat"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Risk_riskNumber_key" ON "Iso27001Risk"("riskNumber");

-- CreateIndex
CREATE INDEX "Iso27001Risk_riskLevel_idx" ON "Iso27001Risk"("riskLevel");

-- CreateIndex
CREATE INDEX "Iso27001Risk_status_idx" ON "Iso27001Risk"("status");

-- CreateIndex
CREATE INDEX "Iso27001Risk_assetId_idx" ON "Iso27001Risk"("assetId");

-- CreateIndex
CREATE INDEX "Iso27001Risk_threatId_idx" ON "Iso27001Risk"("threatId");

-- CreateIndex
CREATE INDEX "Iso27001Risk_nextReviewDate_idx" ON "Iso27001Risk"("nextReviewDate");

-- CreateIndex
CREATE INDEX "Iso27001RiskTreatmentPlan_riskId_idx" ON "Iso27001RiskTreatmentPlan"("riskId");

-- CreateIndex
CREATE INDEX "Iso27001RiskTreatmentPlan_status_idx" ON "Iso27001RiskTreatmentPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001ManagementReview_reviewNumber_key" ON "Iso27001ManagementReview"("reviewNumber");

-- CreateIndex
CREATE INDEX "Iso27001ManagementReview_reviewDate_idx" ON "Iso27001ManagementReview"("reviewDate");

-- CreateIndex
CREATE INDEX "Iso27001ManagementReview_status_idx" ON "Iso27001ManagementReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Training_trainingNumber_key" ON "Iso27001Training"("trainingNumber");

-- CreateIndex
CREATE INDEX "Iso27001Training_trainingDate_idx" ON "Iso27001Training"("trainingDate");

-- CreateIndex
CREATE INDEX "Iso27001Training_status_idx" ON "Iso27001Training"("status");

-- CreateIndex
CREATE INDEX "Iso27001Training_controlId_idx" ON "Iso27001Training"("controlId");

-- CreateIndex
CREATE INDEX "Iso27001Training_isOnline_idx" ON "Iso27001Training"("isOnline");

-- CreateIndex
CREATE INDEX "Iso27001TrainingParticipant_trainingId_idx" ON "Iso27001TrainingParticipant"("trainingId");

-- CreateIndex
CREATE INDEX "Iso27001TrainingAssignment_trainingId_idx" ON "Iso27001TrainingAssignment"("trainingId");

-- CreateIndex
CREATE INDEX "Iso27001TrainingAssignment_userId_idx" ON "Iso27001TrainingAssignment"("userId");

-- CreateIndex
CREATE INDEX "Iso27001TrainingAssignment_status_idx" ON "Iso27001TrainingAssignment"("status");

-- CreateIndex
CREATE INDEX "Iso27001TrainingAssignment_deadline_idx" ON "Iso27001TrainingAssignment"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001TrainingAssignment_trainingId_userId_key" ON "Iso27001TrainingAssignment"("trainingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Asset_assetNumber_key" ON "Iso27001Asset"("assetNumber");

-- CreateIndex
CREATE INDEX "Iso27001Asset_category_idx" ON "Iso27001Asset"("category");

-- CreateIndex
CREATE INDEX "Iso27001Asset_type_idx" ON "Iso27001Asset"("type");

-- CreateIndex
CREATE INDEX "Iso27001Asset_ownerId_idx" ON "Iso27001Asset"("ownerId");

-- CreateIndex
CREATE INDEX "Iso27001Asset_status_idx" ON "Iso27001Asset"("status");

-- CreateIndex
CREATE INDEX "Iso27001Asset_classification_idx" ON "Iso27001Asset"("classification");

-- CreateIndex
CREATE INDEX "Iso27001Asset_barcode_idx" ON "Iso27001Asset"("barcode");

-- CreateIndex
CREATE INDEX "Iso27001Asset_assignedToEmail_idx" ON "Iso27001Asset"("assignedToEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001Incident_incidentNumber_key" ON "Iso27001Incident"("incidentNumber");

-- CreateIndex
CREATE INDEX "Iso27001Incident_incidentNumber_idx" ON "Iso27001Incident"("incidentNumber");

-- CreateIndex
CREATE INDEX "Iso27001Incident_status_idx" ON "Iso27001Incident"("status");

-- CreateIndex
CREATE INDEX "Iso27001Incident_severity_idx" ON "Iso27001Incident"("severity");

-- CreateIndex
CREATE INDEX "Iso27001Incident_reportedById_idx" ON "Iso27001Incident"("reportedById");

-- CreateIndex
CREATE INDEX "Iso27001Incident_assignedToId_idx" ON "Iso27001Incident"("assignedToId");

-- CreateIndex
CREATE INDEX "Iso27001Incident_detectedAt_idx" ON "Iso27001Incident"("detectedAt");

-- CreateIndex
CREATE INDEX "Iso27001IncidentAttachment_incidentId_idx" ON "Iso27001IncidentAttachment"("incidentId");

-- CreateIndex
CREATE INDEX "Iso27001IncidentAction_incidentId_idx" ON "Iso27001IncidentAction"("incidentId");

-- CreateIndex
CREATE INDEX "Iso27001IncidentAction_status_idx" ON "Iso27001IncidentAction"("status");

-- CreateIndex
CREATE INDEX "Iso27001IncidentAction_assignedToId_idx" ON "Iso27001IncidentAction"("assignedToId");

-- CreateIndex
CREATE INDEX "Iso27001IncidentTimeline_incidentId_idx" ON "Iso27001IncidentTimeline"("incidentId");

-- CreateIndex
CREATE INDEX "Iso27001IncidentTimeline_performedAt_idx" ON "Iso27001IncidentTimeline"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisitReport_reportNumber_key" ON "VisitReport"("reportNumber");

-- CreateIndex
CREATE INDEX "VisitReport_createdById_idx" ON "VisitReport"("createdById");

-- CreateIndex
CREATE INDEX "VisitReport_status_idx" ON "VisitReport"("status");

-- CreateIndex
CREATE INDEX "VisitReport_visitDate_idx" ON "VisitReport"("visitDate");

-- CreateIndex
CREATE INDEX "VisitReport_companyName_idx" ON "VisitReport"("companyName");

-- CreateIndex
CREATE INDEX "VisitReportParticipant_reportId_idx" ON "VisitReportParticipant"("reportId");

-- CreateIndex
CREATE INDEX "VisitReportAction_reportId_idx" ON "VisitReportAction"("reportId");

-- CreateIndex
CREATE INDEX "VisitReportAction_status_idx" ON "VisitReportAction"("status");

-- CreateIndex
CREATE INDEX "VisitReportAttachment_reportId_idx" ON "VisitReportAttachment"("reportId");

-- CreateIndex
CREATE INDEX "VisitReportEmailLog_reportId_idx" ON "VisitReportEmailLog"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_meetingNumber_key" ON "Meeting"("meetingNumber");

-- CreateIndex
CREATE INDEX "Meeting_organizerId_idx" ON "Meeting"("organizerId");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_scheduledDate_idx" ON "Meeting"("scheduledDate");

-- CreateIndex
CREATE INDEX "Meeting_meetingType_idx" ON "Meeting"("meetingType");

-- CreateIndex
CREATE INDEX "Meeting_department_idx" ON "Meeting"("department");

-- CreateIndex
CREATE INDEX "MeetingAttendee_meetingId_idx" ON "MeetingAttendee"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingAttendee_userId_idx" ON "MeetingAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendee_meetingId_userId_key" ON "MeetingAttendee"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "MeetingAgendaItem_meetingId_idx" ON "MeetingAgendaItem"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingAgendaItem_orderNo_idx" ON "MeetingAgendaItem"("orderNo");

-- CreateIndex
CREATE INDEX "MeetingDecision_meetingId_idx" ON "MeetingDecision"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingDecision_responsibleId_idx" ON "MeetingDecision"("responsibleId");

-- CreateIndex
CREATE INDEX "MeetingDecision_status_idx" ON "MeetingDecision"("status");

-- CreateIndex
CREATE INDEX "MeetingDecision_dueDate_idx" ON "MeetingDecision"("dueDate");

-- CreateIndex
CREATE INDEX "MeetingAttachment_meetingId_idx" ON "MeetingAttachment"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPlan_planNumber_key" ON "ProjectPlan"("planNumber");

-- CreateIndex
CREATE INDEX "ProjectPlan_createdById_idx" ON "ProjectPlan"("createdById");

-- CreateIndex
CREATE INDEX "ProjectPlan_status_idx" ON "ProjectPlan"("status");

-- CreateIndex
CREATE INDEX "ProjectPlanItem_planId_idx" ON "ProjectPlanItem"("planId");

-- CreateIndex
CREATE INDEX "ProjectPlanItem_orderNo_idx" ON "ProjectPlanItem"("orderNo");

-- CreateIndex
CREATE INDEX "CostAnalysis_code_idx" ON "CostAnalysis"("code");

-- CreateIndex
CREATE INDEX "CostAnalysis_parentId_idx" ON "CostAnalysis"("parentId");

-- CreateIndex
CREATE INDEX "CostAnalysis_isLatest_idx" ON "CostAnalysis"("isLatest");

-- CreateIndex
CREATE INDEX "CostAnalysis_status_idx" ON "CostAnalysis"("status");

-- CreateIndex
CREATE INDEX "CostAnalysis_categoryId_idx" ON "CostAnalysis"("categoryId");

-- CreateIndex
CREATE INDEX "CostAnalysis_customerId_idx" ON "CostAnalysis"("customerId");

-- CreateIndex
CREATE INDEX "CostAnalysis_createdAt_idx" ON "CostAnalysis"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CostAnalysis_code_revisionNumber_key" ON "CostAnalysis"("code", "revisionNumber");

-- CreateIndex
CREATE INDEX "CostMaterial_costAnalysisId_idx" ON "CostMaterial"("costAnalysisId");

-- CreateIndex
CREATE INDEX "CostMaterial_supplierId_idx" ON "CostMaterial"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "CostMaterialCatalog_code_key" ON "CostMaterialCatalog"("code");

-- CreateIndex
CREATE INDEX "CostMaterialCatalog_category_idx" ON "CostMaterialCatalog"("category");

-- CreateIndex
CREATE INDEX "CostMaterialCatalog_isActive_idx" ON "CostMaterialCatalog"("isActive");

-- CreateIndex
CREATE INDEX "CostMaterialCatalog_supplierId_idx" ON "CostMaterialCatalog"("supplierId");

-- CreateIndex
CREATE INDEX "CostLabor_costAnalysisId_idx" ON "CostLabor"("costAnalysisId");

-- CreateIndex
CREATE INDEX "CostLabor_machineId_idx" ON "CostLabor"("machineId");

-- CreateIndex
CREATE INDEX "CostExternalService_costAnalysisId_idx" ON "CostExternalService"("costAnalysisId");

-- CreateIndex
CREATE INDEX "CostExternalService_supplierId_idx" ON "CostExternalService"("supplierId");

-- CreateIndex
CREATE INDEX "CostOtherItem_costAnalysisId_idx" ON "CostOtherItem"("costAnalysisId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCategory_code_key" ON "CostCategory"("code");

-- CreateIndex
CREATE INDEX "CostCategory_isActive_sortOrder_idx" ON "CostCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CostCustomer_code_key" ON "CostCustomer"("code");

-- CreateIndex
CREATE INDEX "CostCustomer_isActive_idx" ON "CostCustomer"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CostSupplier_code_key" ON "CostSupplier"("code");

-- CreateIndex
CREATE INDEX "CostSupplier_isActive_idx" ON "CostSupplier"("isActive");

-- CreateIndex
CREATE INDEX "CostSupplier_type_idx" ON "CostSupplier"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CostMachine_code_key" ON "CostMachine"("code");

-- CreateIndex
CREATE INDEX "CostMachine_isActive_idx" ON "CostMachine"("isActive");

-- CreateIndex
CREATE INDEX "CostExchangeRate_effectiveDate_idx" ON "CostExchangeRate"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "CostExchangeRate_fromCurrency_toCurrency_effectiveDate_key" ON "CostExchangeRate"("fromCurrency", "toCurrency", "effectiveDate");

-- CreateIndex
CREATE INDEX "CostAnalysisVersion_costAnalysisId_idx" ON "CostAnalysisVersion"("costAnalysisId");

-- CreateIndex
CREATE INDEX "CostAnalysisVersion_createdAt_idx" ON "CostAnalysisVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FAQCategory_slug_key" ON "FAQCategory"("slug");

-- CreateIndex
CREATE INDEX "FAQCategory_isActive_sortOrder_idx" ON "FAQCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "FAQ_categoryId_isPublished_sortOrder_idx" ON "FAQ"("categoryId", "isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "FAQ_isPublished_viewCount_idx" ON "FAQ"("isPublished", "viewCount");

-- CreateIndex
CREATE INDEX "FAQ_isPublished_helpfulCount_idx" ON "FAQ"("isPublished", "helpfulCount");

-- CreateIndex
CREATE INDEX "FAQFeedback_faqId_idx" ON "FAQFeedback"("faqId");

-- CreateIndex
CREATE UNIQUE INDEX "FAQFeedback_faqId_userId_key" ON "FAQFeedback"("faqId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FAQFeedback_faqId_ipHash_key" ON "FAQFeedback"("faqId", "ipHash");

-- CreateIndex
CREATE INDEX "CalendarEvent_startDate_endDate_idx" ON "CalendarEvent"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_createdById_idx" ON "CalendarEvent"("createdById");

-- CreateIndex
CREATE INDEX "CalendarEvent_departmentId_idx" ON "CalendarEvent"("departmentId");

-- CreateIndex
CREATE INDEX "CalendarEvent_type_idx" ON "CalendarEvent"("type");

-- CreateIndex
CREATE INDEX "CalendarEvent_isPublic_idx" ON "CalendarEvent"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeForm_formNo_key" ON "OvertimeForm"("formNo");

-- CreateIndex
CREATE INDEX "OvertimeForm_status_idx" ON "OvertimeForm"("status");

-- CreateIndex
CREATE INDEX "OvertimeForm_createdById_idx" ON "OvertimeForm"("createdById");

-- CreateIndex
CREATE INDEX "OvertimeForm_date_idx" ON "OvertimeForm"("date");

-- CreateIndex
CREATE INDEX "OvertimePersonnel_overtimeFormId_idx" ON "OvertimePersonnel"("overtimeFormId");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimePersonnel_overtimeFormId_personnelId_key" ON "OvertimePersonnel"("overtimeFormId", "personnelId");

-- CreateIndex
CREATE INDEX "OvertimeApproval_overtimeFormId_idx" ON "OvertimeApproval"("overtimeFormId");

-- CreateIndex
CREATE INDEX "OvertimeApproval_approverId_idx" ON "OvertimeApproval"("approverId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPosition_code_key" ON "ApprovalPosition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeAuthorizedUser_userId_key" ON "OvertimeAuthorizedUser"("userId");

-- CreateIndex
CREATE INDEX "OvertimeAuthorizedUser_userId_idx" ON "OvertimeAuthorizedUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001PenetrationTest_testNumber_key" ON "Iso27001PenetrationTest"("testNumber");

-- CreateIndex
CREATE INDEX "Iso27001PenetrationTest_testNumber_idx" ON "Iso27001PenetrationTest"("testNumber");

-- CreateIndex
CREATE INDEX "Iso27001PenetrationTest_status_idx" ON "Iso27001PenetrationTest"("status");

-- CreateIndex
CREATE INDEX "Iso27001PenetrationTest_testDate_idx" ON "Iso27001PenetrationTest"("testDate");

-- CreateIndex
CREATE INDEX "Iso27001PenTestFinding_testId_idx" ON "Iso27001PenTestFinding"("testId");

-- CreateIndex
CREATE INDEX "Iso27001PenTestFinding_severity_idx" ON "Iso27001PenTestFinding"("severity");

-- CreateIndex
CREATE INDEX "Iso27001PenTestFinding_actionStatus_idx" ON "Iso27001PenTestFinding"("actionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Iso27001PenTestSignature_signatureCode_key" ON "Iso27001PenTestSignature"("signatureCode");

-- CreateIndex
CREATE INDEX "Iso27001PenTestSignature_testId_idx" ON "Iso27001PenTestSignature"("testId");

-- CreateIndex
CREATE INDEX "Iso27001PenTestSignature_signatureCode_idx" ON "Iso27001PenTestSignature"("signatureCode");

-- CreateIndex
CREATE INDEX "Iso27001PenTestSignature_signedAt_idx" ON "Iso27001PenTestSignature"("signedAt");

-- CreateIndex
CREATE INDEX "Supplier_group_idx" ON "Supplier"("group");

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE INDEX "Supplier_serviceType_idx" ON "Supplier"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierEvaluation_evaluationNo_key" ON "SupplierEvaluation"("evaluationNo");

-- CreateIndex
CREATE INDEX "SupplierEvaluation_supplierId_idx" ON "SupplierEvaluation"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierEvaluation_evaluationDate_idx" ON "SupplierEvaluation"("evaluationDate");

-- CreateIndex
CREATE INDEX "SupplierCriteriaScore_evaluationId_idx" ON "SupplierCriteriaScore"("evaluationId");

-- CreateIndex
CREATE INDEX "SupplierCriteriaScore_criteriaId_idx" ON "SupplierCriteriaScore"("criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierCriteria_code_key" ON "SupplierCriteria"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_sicilNo_key" ON "Personnel"("sicilNo");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_azureAdId_key" ON "Personnel"("azureAdId");

-- CreateIndex
CREATE INDEX "Personnel_bolum_idx" ON "Personnel"("bolum");

-- CreateIndex
CREATE INDEX "Personnel_yakaRengi_idx" ON "Personnel"("yakaRengi");

-- CreateIndex
CREATE INDEX "Personnel_aktif_idx" ON "Personnel"("aktif");

-- CreateIndex
CREATE INDEX "PersonnelEvaluationEmailLog_personnelId_idx" ON "PersonnelEvaluationEmailLog"("personnelId");

-- CreateIndex
CREATE INDEX "PersonnelEvaluationEmailLog_sentAt_idx" ON "PersonnelEvaluationEmailLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelSensitive_personnelId_key" ON "PersonnelSensitive"("personnelId");

-- CreateIndex
CREATE INDEX "PersonnelAccessLog_personnelId_idx" ON "PersonnelAccessLog"("personnelId");

-- CreateIndex
CREATE INDEX "PersonnelAccessLog_accessedBy_idx" ON "PersonnelAccessLog"("accessedBy");

-- CreateIndex
CREATE UNIQUE INDEX "JobTitle_name_key" ON "JobTitle"("name");

-- CreateIndex
CREATE INDEX "JobTitle_isActive_idx" ON "JobTitle"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentDefinition_name_key" ON "DepartmentDefinition"("name");

-- CreateIndex
CREATE INDEX "DepartmentDefinition_isActive_idx" ON "DepartmentDefinition"("isActive");

-- CreateIndex
CREATE INDEX "Intern_bolum_idx" ON "Intern"("bolum");

-- CreateIndex
CREATE INDEX "Intern_aktif_idx" ON "Intern"("aktif");

-- CreateIndex
CREATE INDEX "Consultant_aktif_idx" ON "Consultant"("aktif");

-- CreateIndex
CREATE UNIQUE INDEX "department_packages_packageId_departmentId_key" ON "department_packages"("packageId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "user_course_assignments_userId_assignmentId_key" ON "user_course_assignments"("userId", "assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "user_package_assignments_userId_packageId_key" ON "user_package_assignments"("userId", "packageId");

-- CreateIndex
CREATE UNIQUE INDEX "course_progress_userId_courseId_key" ON "course_progress"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "content_progress_userId_contentId_key" ON "content_progress"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "akademi_certificates_certificateNo_key" ON "akademi_certificates"("certificateNo");

-- CreateIndex
CREATE UNIQUE INDEX "akademi_certificates_verificationCode_key" ON "akademi_certificates"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_userId_badgeId_key" ON "user_badges"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_xp_userId_key" ON "user_xp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "akademi_levels_level_key" ON "akademi_levels"("level");

-- CreateIndex
CREATE UNIQUE INDEX "user_daily_challenges_userId_challengeId_key" ON "user_daily_challenges"("userId", "challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_cache_userId_key" ON "leaderboard_cache"("userId");

-- CreateIndex
CREATE INDEX "_CapaDocuments_B_index" ON "_CapaDocuments"("B");

-- CreateIndex
CREATE INDEX "_AuditFindingDocuments_B_index" ON "_AuditFindingDocuments"("B");

-- CreateIndex
CREATE INDEX "_ChangeRequestDocuments_B_index" ON "_ChangeRequestDocuments"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationDevice" ADD CONSTRAINT "CalibrationDevice_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationDevice" ADD CONSTRAINT "CalibrationDevice_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationHistory" ADD CONSTRAINT "CalibrationHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "CalibrationDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationEmailLog" ADD CONSTRAINT "CalibrationEmailLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "CalibrationDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalibrationEmailLog" ADD CONSTRAINT "CalibrationEmailLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedTask" ADD CONSTRAINT "PlannedTask_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedTask" ADD CONSTRAINT "PlannedTask_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "PlannedTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEmailLog" ADD CONSTRAINT "TaskEmailLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlannedTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SuggestionCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionApproval" ADD CONSTRAINT "SuggestionApproval_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionComment" ADD CONSTRAINT "SuggestionComment_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionTimeline" ADD CONSTRAINT "SuggestionTimeline_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaizenTeamMember" ADD CONSTRAINT "KaizenTeamMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "KaizenProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaizenPDCAStep" ADD CONSTRAINT "KaizenPDCAStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "KaizenProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaizenAttachment" ADD CONSTRAINT "KaizenAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "KaizenProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaizenTimeline" ADD CONSTRAINT "KaizenTimeline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "KaizenProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissAttachment" ADD CONSTRAINT "NearMissAttachment_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissAction" ADD CONSTRAINT "NearMissAction_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NearMissTimeline" ADD CONSTRAINT "NearMissTimeline_nearMissId_fkey" FOREIGN KEY ("nearMissId") REFERENCES "NearMiss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveSAudit" ADD CONSTRAINT "FiveSAudit_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "FiveSArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveSAudit" ADD CONSTRAINT "FiveSAudit_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FiveSTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveSFinding" ADD CONSTRAINT "FiveSFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "FiveSAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveSFinding" ADD CONSTRAINT "FiveSFinding_plannedTaskId_fkey" FOREIGN KEY ("plannedTaskId") REFERENCES "PlannedTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveSPhoto" ADD CONSTRAINT "FiveSPhoto_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "FiveSAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointHistory" ADD CONSTRAINT "PointHistory_employeePointsId_fkey" FOREIGN KEY ("employeePointsId") REFERENCES "EmployeePoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AnnouncementCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementComment" ADD CONSTRAINT "AnnouncementComment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementComment" ADD CONSTRAINT "AnnouncementComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AnnouncementComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementReaction" ADD CONSTRAINT "AnnouncementReaction_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyQuestion" ADD CONSTRAINT "SurveyQuestion_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyOption" ADD CONSTRAINT "SurveyOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "SurveyOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadReceipt" ADD CONSTRAINT "MessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_defaultTeamId_fkey" FOREIGN KEY ("defaultTeamId") REFERENCES "TicketTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedTeamId_fkey" FOREIGN KEY ("assignedTeamId") REFERENCES "TicketTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_parentTicketId_fkey" FOREIGN KEY ("parentTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTimeline" ADD CONSTRAINT "TicketTimeline_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWorkLog" ADD CONSTRAINT "TicketWorkLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_maintenancePlanId_fkey" FOREIGN KEY ("maintenancePlanId") REFERENCES "MaintenancePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeRecord" ADD CONSTRAINT "DowntimeRecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DowntimeRecord" ADD CONSTRAINT "DowntimeRecord_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSparePartUsage" ADD CONSTRAINT "MachineSparePartUsage_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSparePartUsage" ADD CONSTRAINT "MachineSparePartUsage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineSparePartUsage" ADD CONSTRAINT "MachineSparePartUsage_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLaborLog" ADD CONSTRAINT "MaintenanceLaborLog_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTimeline" ADD CONSTRAINT "MaintenanceTimeline_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "MaintenanceWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineDocument" ADD CONSTRAINT "MachineDocument_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineOEERecord" ADD CONSTRAINT "MachineOEERecord_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocument" ADD CONSTRAINT "QdmsDocument_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocument" ADD CONSTRAINT "QdmsDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocument" ADD CONSTRAINT "QdmsDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocumentRevision" ADD CONSTRAINT "QdmsDocumentRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "QdmsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocumentRevision" ADD CONSTRAINT "QdmsDocumentRevision_revisedById_fkey" FOREIGN KEY ("revisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocumentApproval" ADD CONSTRAINT "QdmsDocumentApproval_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "QdmsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocumentApproval" ADD CONSTRAINT "QdmsDocumentApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocumentDistribution" ADD CONSTRAINT "QdmsDocumentDistribution_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "QdmsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocumentDistribution" ADD CONSTRAINT "QdmsDocumentDistribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsDocumentDistribution" ADD CONSTRAINT "QdmsDocumentDistribution_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCapa" ADD CONSTRAINT "QdmsCapa_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCapa" ADD CONSTRAINT "QdmsCapa_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCapa" ADD CONSTRAINT "QdmsCapa_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCapa" ADD CONSTRAINT "QdmsCapa_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCapaAction" ADD CONSTRAINT "QdmsCapaAction_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "QdmsCapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCapaAction" ADD CONSTRAINT "QdmsCapaAction_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformance" ADD CONSTRAINT "QdmsNonConformance_detectedById_fkey" FOREIGN KEY ("detectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformance" ADD CONSTRAINT "QdmsNonConformance_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformance" ADD CONSTRAINT "QdmsNonConformance_dispositionById_fkey" FOREIGN KEY ("dispositionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformance" ADD CONSTRAINT "QdmsNonConformance_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "QdmsCapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsNonConformance" ADD CONSTRAINT "QdmsNonConformance_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsAudit" ADD CONSTRAINT "QdmsAudit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsAudit" ADD CONSTRAINT "QdmsAudit_auditeeId_fkey" FOREIGN KEY ("auditeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsAudit" ADD CONSTRAINT "QdmsAudit_leadAuditorId_fkey" FOREIGN KEY ("leadAuditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsAuditTeamMember" ADD CONSTRAINT "QdmsAuditTeamMember_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "QdmsAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsAuditTeamMember" ADD CONSTRAINT "QdmsAuditTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsAuditChecklist" ADD CONSTRAINT "QdmsAuditChecklist_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "QdmsAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsAuditFinding" ADD CONSTRAINT "QdmsAuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "QdmsAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsAuditFinding" ADD CONSTRAINT "QdmsAuditFinding_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "QdmsCapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsRisk" ADD CONSTRAINT "QdmsRisk_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsRisk" ADD CONSTRAINT "QdmsRisk_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsRisk" ADD CONSTRAINT "QdmsRisk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsSupplierEvaluation" ADD CONSTRAINT "QdmsSupplierEvaluation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "QdmsSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsSupplierEvaluation" ADD CONSTRAINT "QdmsSupplierEvaluation_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsChangeRequest" ADD CONSTRAINT "QdmsChangeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsChangeRequest" ADD CONSTRAINT "QdmsChangeRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsChangeRequest" ADD CONSTRAINT "QdmsChangeRequest_implementedById_fkey" FOREIGN KEY ("implementedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsChangeRequest" ADD CONSTRAINT "QdmsChangeRequest_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsChangeRequestApproval" ADD CONSTRAINT "QdmsChangeRequestApproval_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "QdmsChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsChangeRequestApproval" ADD CONSTRAINT "QdmsChangeRequestApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsTrainingRecord" ADD CONSTRAINT "QdmsTrainingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsTrainingRecord" ADD CONSTRAINT "QdmsTrainingRecord_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "QdmsDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsTrainingRecord" ADD CONSTRAINT "QdmsTrainingRecord_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCustomerComplaint" ADD CONSTRAINT "QdmsCustomerComplaint_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCustomerComplaint" ADD CONSTRAINT "QdmsCustomerComplaint_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCustomerComplaint" ADD CONSTRAINT "QdmsCustomerComplaint_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QdmsCustomerComplaint" ADD CONSTRAINT "QdmsCustomerComplaint_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "QdmsCapa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_nextPositionId_fkey" FOREIGN KEY ("nextPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionCompetency" ADD CONSTRAINT "PositionCompetency_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionCompetency" ADD CONSTRAINT "PositionCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentProfile" ADD CONSTRAINT "TalentProfile_currentPositionId_fkey" FOREIGN KEY ("currentPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompetency" ADD CONSTRAINT "EmployeeCompetency_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompetency" ADD CONSTRAINT "EmployeeCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessionPlan" ADD CONSTRAINT "SuccessionPlan_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessionCandidate" ADD CONSTRAINT "SuccessionCandidate_successionPlanId_fkey" FOREIGN KEY ("successionPlanId") REFERENCES "SuccessionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessionCandidate" ADD CONSTRAINT "SuccessionCandidate_readyNowProfileId_fkey" FOREIGN KEY ("readyNowProfileId") REFERENCES "TalentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessionCandidate" ADD CONSTRAINT "SuccessionCandidate_readyIn1YearProfileId_fkey" FOREIGN KEY ("readyIn1YearProfileId") REFERENCES "TalentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuccessionCandidate" ADD CONSTRAINT "SuccessionCandidate_readyIn2YearsProfileId_fkey" FOREIGN KEY ("readyIn2YearsProfileId") REFERENCES "TalentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerPath" ADD CONSTRAINT "CareerPath_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerPath" ADD CONSTRAINT "CareerPath_targetPositionId_fkey" FOREIGN KEY ("targetPositionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "TalentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentGoal" ADD CONSTRAINT "DevelopmentGoal_developmentPlanId_fkey" FOREIGN KEY ("developmentPlanId") REFERENCES "DevelopmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipRelation" ADD CONSTRAINT "MentorshipRelation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "TalentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipRelation" ADD CONSTRAINT "MentorshipRelation_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "TalentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PerformanceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_feedbackRequestId_fkey" FOREIGN KEY ("feedbackRequestId") REFERENCES "FeedbackRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelRequest" ADD CONSTRAINT "PersonnelRequest_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewStage" ADD CONSTRAINT "InterviewStage_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgEmployee" ADD CONSTRAINT "OrgEmployee_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgEmployee" ADD CONSTRAINT "OrgEmployee_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "OrgEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001DocumentVersion" ADD CONSTRAINT "Iso27001DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Iso27001Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Signature" ADD CONSTRAINT "Iso27001Signature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Iso27001Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001ControlDocument" ADD CONSTRAINT "Iso27001ControlDocument_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Iso27001Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001ControlDocument" ADD CONSTRAINT "Iso27001ControlDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Iso27001Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Evidence" ADD CONSTRAINT "Iso27001Evidence_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Iso27001Control"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001AuditProgramAuditor" ADD CONSTRAINT "Iso27001AuditProgramAuditor_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Iso27001AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001AuditProgramItem" ADD CONSTRAINT "Iso27001AuditProgramItem_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Iso27001AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001AuditTeamMember" ADD CONSTRAINT "Iso27001AuditTeamMember_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Iso27001Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001AuditFinding" ADD CONSTRAINT "Iso27001AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Iso27001Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001AuditFinding" ADD CONSTRAINT "Iso27001AuditFinding_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Iso27001Control"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Risk" ADD CONSTRAINT "Iso27001Risk_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Iso27001Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Risk" ADD CONSTRAINT "Iso27001Risk_threatId_fkey" FOREIGN KEY ("threatId") REFERENCES "Iso27001Threat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001RiskTreatmentPlan" ADD CONSTRAINT "Iso27001RiskTreatmentPlan_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Iso27001Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001TrainingParticipant" ADD CONSTRAINT "Iso27001TrainingParticipant_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Iso27001Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001TrainingAssignment" ADD CONSTRAINT "Iso27001TrainingAssignment_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Iso27001Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001TrainingAssignment" ADD CONSTRAINT "Iso27001TrainingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Asset" ADD CONSTRAINT "Iso27001Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Asset" ADD CONSTRAINT "Iso27001Asset_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Asset" ADD CONSTRAINT "Iso27001Asset_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "Iso27001Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Incident" ADD CONSTRAINT "Iso27001Incident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001Incident" ADD CONSTRAINT "Iso27001Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001IncidentAttachment" ADD CONSTRAINT "Iso27001IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Iso27001Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001IncidentAction" ADD CONSTRAINT "Iso27001IncidentAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Iso27001Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001IncidentAction" ADD CONSTRAINT "Iso27001IncidentAction_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001IncidentTimeline" ADD CONSTRAINT "Iso27001IncidentTimeline_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Iso27001Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReport" ADD CONSTRAINT "VisitReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReport" ADD CONSTRAINT "VisitReport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReportParticipant" ADD CONSTRAINT "VisitReportParticipant_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VisitReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReportAction" ADD CONSTRAINT "VisitReportAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VisitReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReportAttachment" ADD CONSTRAINT "VisitReportAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VisitReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitReportEmailLog" ADD CONSTRAINT "VisitReportEmailLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VisitReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_chairmanId_fkey" FOREIGN KEY ("chairmanId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_rapporteurId_fkey" FOREIGN KEY ("rapporteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_minutesApprovedById_fkey" FOREIGN KEY ("minutesApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_previousMeetingId_fkey" FOREIGN KEY ("previousMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_presenterId_fkey" FOREIGN KEY ("presenterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttachment" ADD CONSTRAINT "MeetingAttachment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttachment" ADD CONSTRAINT "MeetingAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlanItem" ADD CONSTRAINT "ProjectPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAnalysis" ADD CONSTRAINT "CostAnalysis_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CostAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAnalysis" ADD CONSTRAINT "CostAnalysis_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAnalysis" ADD CONSTRAINT "CostAnalysis_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CostCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMaterial" ADD CONSTRAINT "CostMaterial_costAnalysisId_fkey" FOREIGN KEY ("costAnalysisId") REFERENCES "CostAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMaterial" ADD CONSTRAINT "CostMaterial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CostSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostMaterialCatalog" ADD CONSTRAINT "CostMaterialCatalog_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CostSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLabor" ADD CONSTRAINT "CostLabor_costAnalysisId_fkey" FOREIGN KEY ("costAnalysisId") REFERENCES "CostAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostLabor" ADD CONSTRAINT "CostLabor_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "CostMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostExternalService" ADD CONSTRAINT "CostExternalService_costAnalysisId_fkey" FOREIGN KEY ("costAnalysisId") REFERENCES "CostAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostExternalService" ADD CONSTRAINT "CostExternalService_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CostSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostOtherItem" ADD CONSTRAINT "CostOtherItem_costAnalysisId_fkey" FOREIGN KEY ("costAnalysisId") REFERENCES "CostAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAnalysisVersion" ADD CONSTRAINT "CostAnalysisVersion_costAnalysisId_fkey" FOREIGN KEY ("costAnalysisId") REFERENCES "CostAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAQ" ADD CONSTRAINT "FAQ_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FAQCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAQ" ADD CONSTRAINT "FAQ_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FAQFeedback" ADD CONSTRAINT "FAQFeedback_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "FAQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeForm" ADD CONSTRAINT "OvertimeForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimePersonnel" ADD CONSTRAINT "OvertimePersonnel_overtimeFormId_fkey" FOREIGN KEY ("overtimeFormId") REFERENCES "OvertimeForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimePersonnel" ADD CONSTRAINT "OvertimePersonnel_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimePersonnel" ADD CONSTRAINT "OvertimePersonnel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_overtimeFormId_fkey" FOREIGN KEY ("overtimeFormId") REFERENCES "OvertimeForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPosition" ADD CONSTRAINT "ApprovalPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeAuthorizedUser" ADD CONSTRAINT "OvertimeAuthorizedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001PenTestFinding" ADD CONSTRAINT "Iso27001PenTestFinding_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Iso27001PenetrationTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iso27001PenTestSignature" ADD CONSTRAINT "Iso27001PenTestSignature_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Iso27001PenetrationTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierEvaluation" ADD CONSTRAINT "SupplierEvaluation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierEvaluation" ADD CONSTRAINT "SupplierEvaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCriteriaScore" ADD CONSTRAINT "SupplierCriteriaScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "SupplierEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCriteriaScore" ADD CONSTRAINT "SupplierCriteriaScore_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "SupplierCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelEvaluationEmailLog" ADD CONSTRAINT "PersonnelEvaluationEmailLog_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelSensitive" ADD CONSTRAINT "PersonnelSensitive_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelAccessLog" ADD CONSTRAINT "PersonnelAccessLog_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_packages" ADD CONSTRAINT "course_packages_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_assignments" ADD CONSTRAINT "course_assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_packages" ADD CONSTRAINT "department_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "course_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_packages" ADD CONSTRAINT "department_packages_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_assignments" ADD CONSTRAINT "user_course_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_assignments" ADD CONSTRAINT "user_course_assignments_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "course_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_package_assignments" ADD CONSTRAINT "user_package_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_package_assignments" ADD CONSTRAINT "user_package_assignments_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "course_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_progress" ADD CONSTRAINT "content_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_progress" ADD CONSTRAINT "content_progress_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "exam_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_attempts" ADD CONSTRAINT "user_exam_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_attempts" ADD CONSTRAINT "user_exam_attempts_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "user_exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "exam_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_exam_answers" ADD CONSTRAINT "user_exam_answers_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akademi_certificates" ADD CONSTRAINT "akademi_certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akademi_certificates" ADD CONSTRAINT "akademi_certificates_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akademi_certificates" ADD CONSTRAINT "akademi_certificates_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "akademi_certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akademi_certificate_downloads" ADD CONSTRAINT "akademi_certificate_downloads_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "akademi_certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akademi_certificate_verifications" ADD CONSTRAINT "akademi_certificate_verifications_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "akademi_certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_xp" ADD CONSTRAINT "user_xp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_history" ADD CONSTRAINT "xp_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_daily_challenges" ADD CONSTRAINT "user_daily_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_daily_challenges" ADD CONSTRAINT "user_daily_challenges_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "daily_challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "akademi_notifications" ADD CONSTRAINT "akademi_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CapaDocuments" ADD CONSTRAINT "_CapaDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "QdmsCapa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CapaDocuments" ADD CONSTRAINT "_CapaDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "QdmsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AuditFindingDocuments" ADD CONSTRAINT "_AuditFindingDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "QdmsAuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AuditFindingDocuments" ADD CONSTRAINT "_AuditFindingDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "QdmsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChangeRequestDocuments" ADD CONSTRAINT "_ChangeRequestDocuments_A_fkey" FOREIGN KEY ("A") REFERENCES "QdmsChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChangeRequestDocuments" ADD CONSTRAINT "_ChangeRequestDocuments_B_fkey" FOREIGN KEY ("B") REFERENCES "QdmsDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

