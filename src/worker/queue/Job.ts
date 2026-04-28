export class Job<TPayload> {
  public readonly id: string;
  public readonly name: string;
  public readonly payload: TPayload;
  public readonly createdAt: Date;

  public constructor(id: string, name: string, payload: TPayload, createdAt?: Date) {
    this.id = id;
    this.name = name;
    this.payload = payload;
    this.createdAt = createdAt ?? new Date();
  }
}
