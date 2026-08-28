export type WorkflowRule = Record<string, unknown>;

export interface WorkflowRuleViolation {
  code: string;
  path: string;
  operator: string;
  actual: unknown;
  expected: unknown;
  message: string;
}

export class WorkflowRuleEngine {
  public evaluate(rules: unknown, source: Record<string, unknown>): { valid: boolean; violations: WorkflowRuleViolation[] } {
    const normalizedRules = Array.isArray(rules) ? rules : [];
    const violations = normalizedRules.flatMap((rule, index) => this.evaluateRule(rule, source, `rules.${index}`));
    return { valid: violations.length === 0, violations };
  }

  private evaluateRule(rawRule: unknown, source: Record<string, unknown>, fallbackPath: string): WorkflowRuleViolation[] {
    const rule = this.toRecord(rawRule);
    if (Array.isArray(rule.all)) {
      return rule.all.flatMap((item, index) => this.evaluateRule(item, source, `${fallbackPath}.all.${index}`));
    }
    if (Array.isArray(rule.any)) {
      const groups = rule.any.map((item, index) => this.evaluateRule(item, source, `${fallbackPath}.any.${index}`));
      return groups.some((violations) => violations.length === 0)
        ? []
        : [this.violation(fallbackPath, "any", null, null, "Nessuna delle condizioni alternative e soddisfatta.")];
    }
    if (rule.not && typeof rule.not === "object") {
      return this.evaluateRule(rule.not, source, `${fallbackPath}.not`).length > 0
        ? []
        : [this.violation(fallbackPath, "not", null, null, "La condizione negata risulta soddisfatta.")];
    }

    const path = typeof rule.path === "string" && rule.path.trim() ? rule.path.trim() : fallbackPath;
    const operator = typeof rule.operator === "string" ? rule.operator.trim().toLowerCase() : "exists";
    const actual = this.readPath(source, path);
    const expected = rule.value;
    const other = typeof rule.otherPath === "string" ? this.readPath(source, rule.otherPath) : expected;
    const valid = this.compare(operator, actual, other, rule);
    return valid ? [] : [this.violation(path, operator, actual, other, this.messageFor(path, operator, other))];
  }

  private compare(operator: string, actual: unknown, expected: unknown, rule: Record<string, unknown>): boolean {
    const text = this.toText(actual);
    const expectedText = this.toText(expected);
    const normalized = rule.caseSensitive === true ? text : text.toLocaleLowerCase();
    const normalizedExpected = rule.caseSensitive === true ? expectedText : expectedText.toLocaleLowerCase();
    const numeric = Number(actual);
    const expectedNumeric = Number(expected);

    switch (operator) {
      case "exists": return actual !== null && actual !== undefined;
      case "missing": return actual === null || actual === undefined;
      case "truthy": return Boolean(actual);
      case "falsy": return !actual;
      case "empty": return actual === null || actual === undefined || text.trim() === "" || (Array.isArray(actual) && actual.length === 0);
      case "not_empty": return !(actual === null || actual === undefined || text.trim() === "" || (Array.isArray(actual) && actual.length === 0));
      case "equals": return actual === expected || normalized === normalizedExpected;
      case "not_equals": return !(actual === expected || normalized === normalizedExpected);
      case "contains": return normalized.includes(normalizedExpected);
      case "not_contains": return !normalized.includes(normalizedExpected);
      case "starts_with": return normalized.startsWith(normalizedExpected);
      case "ends_with": return normalized.endsWith(normalizedExpected);
      case "regex": return this.matchesRegex(text, expectedText);
      case "not_regex": return !this.matchesRegex(text, expectedText);
      case "greater_than": return Number.isFinite(numeric) && Number.isFinite(expectedNumeric) && numeric > expectedNumeric;
      case "greater_or_equal": return Number.isFinite(numeric) && Number.isFinite(expectedNumeric) && numeric >= expectedNumeric;
      case "less_than": return Number.isFinite(numeric) && Number.isFinite(expectedNumeric) && numeric < expectedNumeric;
      case "less_or_equal": return Number.isFinite(numeric) && Number.isFinite(expectedNumeric) && numeric <= expectedNumeric;
      case "between": {
        const min = Number(rule.min);
        const max = Number(rule.max);
        return Number.isFinite(numeric) && Number.isFinite(min) && Number.isFinite(max) && numeric >= min && numeric <= max;
      }
      case "in": return Array.isArray(expected) && expected.some((item) => this.toText(item) === text);
      case "not_in": return Array.isArray(expected) && !expected.some((item) => this.toText(item) === text);
      case "length_at_least": return this.lengthOf(actual) >= Number(expected);
      case "length_at_most": return this.lengthOf(actual) <= Number(expected);
      case "type_is": return this.typeOf(actual) === expectedText.toLowerCase();
      default: return false;
    }
  }

  private matchesRegex(value: string, pattern: string): boolean {
    if (!pattern) return false;
    try {
      return new RegExp(pattern).test(value);
    } catch {
      return false;
    }
  }

  private readPath(source: Record<string, unknown>, path: string): unknown {
    return path.split(".").filter(Boolean).reduce<unknown>((current, key) => (
      current && typeof current === "object" && !Array.isArray(current)
        ? (current as Record<string, unknown>)[key]
        : undefined
    ), source);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private toText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }

  private lengthOf(value: unknown): number {
    return typeof value === "string" || Array.isArray(value) ? value.length : 0;
  }

  private typeOf(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  private violation(path: string, operator: string, actual: unknown, expected: unknown, message: string): WorkflowRuleViolation {
    return { code: "WORKFLOW_RULE_NOT_MET", path, operator, actual, expected, message };
  }

  private messageFor(path: string, operator: string, expected: unknown): string {
    return `Regola non soddisfatta: ${path} (${operator}${expected === undefined ? "" : ` ${this.toText(expected)}`}).`;
  }
}
