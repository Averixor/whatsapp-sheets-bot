function _diagResolveKnownSymbolStage7_(name) {
  switch (String(name || '').trim()) {
    case 'DataAccess_': return typeof DataAccess_ !== 'undefined' ? DataAccess_ : undefined;
    case 'DictionaryRepository_': return typeof DictionaryRepository_ !== 'undefined' ? DictionaryRepository_ : undefined;
    case 'PersonsRepository_': return typeof PersonsRepository_ !== 'undefined' ? PersonsRepository_ : undefined;
    case 'SendPanelRepository_': return typeof SendPanelRepository_ !== 'undefined' ? SendPanelRepository_ : undefined;
    case 'VacationsRepository_': return typeof VacationsRepository_ !== 'undefined' ? VacationsRepository_ : undefined;
    case 'SummaryRepository_': return typeof SummaryRepository_ !== 'undefined' ? SummaryRepository_ : undefined;
    case 'LogsRepository_': return typeof LogsRepository_ !== 'undefined' ? LogsRepository_ : undefined;
    case 'Stage7UseCases_': return typeof Stage7UseCases_ !== 'undefined' ? Stage7UseCases_ : undefined;
    case 'WorkflowOrchestrator_': return typeof WorkflowOrchestrator_ !== 'undefined' ? WorkflowOrchestrator_ : undefined;
    case 'Stage7AuditTrail_': return typeof Stage7AuditTrail_ !== 'undefined' ? Stage7AuditTrail_ : undefined;
    case 'Reconciliation_': return typeof Reconciliation_ !== 'undefined' ? Reconciliation_ : undefined;
    case 'Stage7Triggers_': return typeof Stage7Triggers_ !== 'undefined' ? Stage7Triggers_ : undefined;
    case 'Stage7Templates_': return typeof Stage7Templates_ !== 'undefined' ? Stage7Templates_ : undefined;
    case 'OperationRepository_': return typeof OperationRepository_ !== 'undefined' ? OperationRepository_ : undefined;
    case 'SheetSchemas_': return typeof SheetSchemas_ !== 'undefined' ? SheetSchemas_ : undefined;
    case 'SheetStandards_': return typeof SheetStandards_ !== 'undefined' ? SheetStandards_ : undefined;
    case 'Validation_': return typeof Validation_ !== 'undefined' ? Validation_ : undefined;
    default: return undefined;
  }
}
