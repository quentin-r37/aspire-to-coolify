/**
 * Aspire intermediate model types
 * These types represent the parsed structure from Program.cs
 */
export interface AspireApp {
    services: Service[];
    databases: Database[];
    storage: StorageService[];
    applications: Application[];
    references: Reference[];
}
export interface Service {
    name: string;
    type: ServiceType;
    variableName?: string;
    image?: string;
    imageTag?: string;
    hostPort?: number;
    environment: EnvironmentVariable[];
    volumes: Volume[];
    endpoints: Endpoint[];
    references: string[];
}
export type ServiceType = 'redis' | 'rabbitmq' | 'minio' | 'keycloak' | 'seq' | 'maildev' | 'mongodb' | 'mysql' | 'mariadb' | 'kafka' | 'elasticsearch' | 'custom';
export interface Database {
    name: string;
    type: DatabaseType;
    variableName?: string;
    serverName?: string;
    serverVariableName?: string;
    image?: string;
    imageTag?: string;
    hostPort?: number;
    hasDataVolume: boolean;
    environment: EnvironmentVariable[];
}
export type DatabaseType = 'postgres' | 'sqlserver' | 'mysql' | 'mongodb' | 'redis';
export interface StorageService {
    name: string;
    type: StorageType;
    variableName?: string;
    image?: string;
    imageTag?: string;
    hostPort?: number;
    environment: EnvironmentVariable[];
    volumes: Volume[];
}
export type StorageType = 'minio' | 'azurite' | 'blob';
export interface Application {
    name: string;
    type: ApplicationType;
    variableName?: string;
    sourcePath?: string;
    project?: string;
    buildPack: BuildPack;
    environment: EnvironmentVariable[];
    endpoints: Endpoint[];
    references: string[];
    publishMode?: 'dockerfile' | 'container';
}
export type ApplicationType = 'npm' | 'project' | 'container' | 'dockerfile' | 'executable';
export type BuildPack = 'nixpacks' | 'dockerfile' | 'static' | 'node';
export interface EnvironmentVariable {
    key: string;
    value: string;
    isExpression?: boolean;
}
export interface Volume {
    name?: string;
    mountPath?: string;
    isData: boolean;
}
export interface Endpoint {
    name?: string;
    port?: number;
    targetPort?: number;
    protocol: 'http' | 'https' | 'tcp' | 'udp';
    isExternal: boolean;
    envVariable?: string;
}
export interface Reference {
    from: string;
    to: string;
    connectionStringEnv?: string;
}
export declare function createEmptyAspireApp(): AspireApp;
//# sourceMappingURL=aspire.d.ts.map