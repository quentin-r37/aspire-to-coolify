/**
 * Coolify CLI command types
 */
export interface CoolifyCommand {
    command: string;
    args: string[];
    comment?: string;
}
export interface CoolifyDatabaseCommand extends CoolifyCommand {
    command: 'database:create';
    type: CoolifyDatabaseType;
    name: string;
    image?: string;
    publicPort?: number;
    envVars: Record<string, string>;
}
export type CoolifyDatabaseType = 'postgres' | 'mysql' | 'mariadb' | 'mongodb' | 'redis' | 'keydb' | 'dragonfly' | 'clickhouse';
export interface CoolifyServiceCommand extends CoolifyCommand {
    command: 'service:create';
    type: CoolifyServiceType;
    name: string;
    image?: string;
    envVars: Record<string, string>;
}
export type CoolifyServiceType = 'minio' | 'rabbitmq' | 'keycloak' | 'seq' | 'mailpit' | 'kafka' | 'elasticsearch' | 'custom';
export interface CoolifyApplicationCommand extends CoolifyCommand {
    command: 'application:create';
    name: string;
    buildPack: CoolifyBuildPack;
    source?: string;
    envVars: Record<string, string>;
    ports?: number[];
}
export type CoolifyBuildPack = 'nixpacks' | 'dockerfile' | 'docker-compose' | 'static' | 'dockerimage';
export interface CoolifyOutput {
    commands: CoolifyCommand[];
    script: string;
}
export declare function formatCommand(cmd: CoolifyCommand): string;
export declare function formatOutput(output: CoolifyOutput): string;
//# sourceMappingURL=coolify.d.ts.map