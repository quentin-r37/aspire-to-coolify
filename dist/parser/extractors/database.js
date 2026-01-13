/**
 * Database extractor - parses database-related Aspire methods
 */
import { extractFirstStringArg } from '../tokenizer.js';
const DATABASE_METHODS = {
    AddPostgres: 'postgres',
    AddAzurePostgresFlexibleServer: 'postgres',
    AddPostgresContainer: 'postgres',
    AddSqlServer: 'sqlserver',
    AddAzureSqlServer: 'sqlserver',
    AddMySql: 'mysql',
    AddMySqlContainer: 'mysql',
    AddMongoDB: 'mongodb',
    AddMongoDBContainer: 'mongodb',
    AddRedis: 'redis',
    AddRedisContainer: 'redis',
};
export function isDatabaseChain(chain) {
    return chain.rootMethod in DATABASE_METHODS;
}
export function extractDatabase(chain) {
    const dbType = DATABASE_METHODS[chain.rootMethod] || 'postgres';
    const database = {
        name: chain.name,
        type: dbType,
        variableName: chain.variableName,
        hasDataVolume: false,
        environment: [],
    };
    // Process chained methods
    for (const method of chain.chainedMethods) {
        switch (method.method) {
            case 'WithImage':
                database.image = extractFirstStringArg(method.rawArgs) || undefined;
                break;
            case 'WithImageTag':
                database.imageTag = extractFirstStringArg(method.rawArgs) || undefined;
                break;
            case 'WithHostPort':
                const portArg = method.args[0];
                if (portArg) {
                    database.hostPort = parseInt(portArg, 10) || undefined;
                }
                break;
            case 'WithDataVolume':
                database.hasDataVolume = true;
                break;
            case 'WithEnvironment':
                const env = extractEnvironment(method.args);
                if (env) {
                    database.environment.push(env);
                }
                break;
            case 'RunAsContainer':
                // Process nested lambda configuration
                const nestedMethods = extractNestedMethods(method.rawArgs);
                for (const nested of nestedMethods) {
                    processNestedMethod(database, nested);
                }
                break;
        }
    }
    return database;
}
/**
 * Extract databases from .AddDatabase() calls on a server chain
 */
export function extractChildDatabases(chains) {
    const databases = [];
    for (const chain of chains) {
        if (chain.rootMethod === 'AddDatabase') {
            // Find the parent server by baseObject variable name
            const parentChain = chains.find((c) => c.variableName === chain.baseObject);
            databases.push({
                name: chain.name,
                type: parentChain ? (DATABASE_METHODS[parentChain.rootMethod] || 'postgres') : 'postgres',
                variableName: chain.variableName,
                serverName: parentChain?.name,
                serverVariableName: chain.baseObject,
                hasDataVolume: false,
                environment: [],
            });
        }
    }
    return databases;
}
function extractEnvironment(args) {
    if (args.length < 2)
        return null;
    const key = extractFirstStringArg(args[0]) || args[0].replace(/["']/g, '');
    const value = extractFirstStringArg(args[1]) || args[1].replace(/["']/g, '');
    return { key, value };
}
function extractNestedMethods(argsStr) {
    const methods = [];
    // Match lambda patterns: a => a.Method(args).Method2(args)
    const lambdaMatch = argsStr.match(/\w+\s*=>\s*\w+((?:\s*\.\s*\w+\s*\([^)]*\))+)/);
    if (lambdaMatch) {
        const chainPart = lambdaMatch[1];
        const methodRegex = /\.(\w+)\s*\(([^)]*)\)/g;
        let match;
        while ((match = methodRegex.exec(chainPart)) !== null) {
            methods.push({
                method: match[1],
                args: match[2].split(',').map((a) => a.trim()),
            });
        }
    }
    return methods;
}
function processNestedMethod(database, nested) {
    switch (nested.method) {
        case 'WithImage':
            database.image = extractFirstStringArg(nested.args[0]) || nested.args[0]?.replace(/["']/g, '');
            break;
        case 'WithImageTag':
            database.imageTag =
                extractFirstStringArg(nested.args[0]) || nested.args[0]?.replace(/["']/g, '');
            break;
        case 'WithHostPort':
            database.hostPort = parseInt(nested.args[0], 10) || undefined;
            break;
        case 'WithDataVolume':
            database.hasDataVolume = true;
            break;
    }
}
//# sourceMappingURL=database.js.map