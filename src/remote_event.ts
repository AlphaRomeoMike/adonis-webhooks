/**
 * A webhook received from a remote service, after its signature
 * has been verified and its payload parsed
 */
export class RemoteEvent<Payload = unknown> {
  constructor(
    public id: string,
    public name: string,
    public payload: Payload
  ) {}
}
