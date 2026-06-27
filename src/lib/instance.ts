export function getInstanceName(): string {
  return process.env.INSTANCE_NAME ?? 'Stays';
}

export function isNonDefault(): boolean {
  return getInstanceName() !== 'Stays';
}
