/**
 * Database command generator for Coolify
 */
const ASPIRE_TO_COOLIFY_DB = {
    postgres: 'postgres',
    sqlserver: 'postgres', // Coolify doesn't have native SQL Server, use PostgreSQL as fallback
    mysql: 'mysql',
    mongodb: 'mongodb',
    redis: 'redis',
};
export function generateDatabaseCommand(db) {
    const coolifyType = ASPIRE_TO_COOLIFY_DB[db.type] || 'postgres';
    const args = [
        `--name "${db.name}"`,
        `--type ${coolifyType}`,
    ];
    // Add custom image if specified
    if (db.image) {
        const imageWithTag = db.imageTag ? `${db.image}:${db.imageTag}` : db.image;
        args.push(`--image "${imageWithTag}"`);
    }
    // Add public port if specified
    if (db.hostPort) {
        args.push(`--public-port ${db.hostPort}`);
    }
    // Add environment variables
    const envVars = {};
    for (const env of db.environment) {
        envVars[env.key] = env.value;
        args.push(`--env "${env.key}=${env.value}"`);
    }
    return {
        command: 'database:create',
        type: coolifyType,
        name: db.name,
        image: db.image ? (db.imageTag ? `${db.image}:${db.imageTag}` : db.image) : undefined,
        publicPort: db.hostPort,
        envVars,
        args,
        comment: `Database: ${db.name} (${db.type})`,
    };
}
/**
 * Generate connection string placeholder for a database
 */
export function getDatabaseConnectionString(db) {
    switch (db.type) {
        case 'postgres':
            return `\${${db.name}.connectionString}`;
        case 'mysql':
            return `\${${db.name}.connectionString}`;
        case 'mongodb':
            return `\${${db.name}.connectionString}`;
        case 'redis':
            return `\${${db.name}.connectionString}`;
        default:
            return `\${${db.name}.connectionString}`;
    }
}
//# sourceMappingURL=database.js.map