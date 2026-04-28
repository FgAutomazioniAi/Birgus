import { DdtAnalysisInput } from "../repositories/DdtProcessingRepository.js";

export interface DdtAnalyzer {
  analyze(ddtDocumentId: string): Promise<DdtAnalysisInput>;
}
