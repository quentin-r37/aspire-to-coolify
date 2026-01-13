/**
 * Container/Service extractor - parses container-related Aspire methods
 */
import { extractFirstStringArg, extractNamedArgs } from '../tokenizer.js';
const CONTAINER_METHODS = {
    AddMinioContainer: 'minio',
    AddMinio: 'minio',
    AddRabbitMQ: 'rabbitmq',
    AddRabbitMQContainer: 'rabbitmq',
    AddKeycloak: 'keycloak',
    AddKeycloakContainer: 'keycloak',
    AddSeq: 'seq',
    AddSeqContainer: 'seq',
    AddMailDev: 'maildev',
    AddMailDevContainer: 'maildev',
    AddKafka: 'kafka',
    AddKafkaContainer: 'kafka',
    AddElasticsearch: 'elasticsearch',
    AddElasticsearchContainer: 'elasticsearch',
    AddContainer: 'custom',
};
export function isContainerChain(chain) {
    return chain.rootMethod in CONTAINER_METHODS;
}
export function extractContainer(chain) {
    const serviceType = CONTAINER_METHODS[chain.rootMethod] || 'custom';
    const service = {
        name: chain.name,
        type: serviceType,
        variableName: chain.variableName,
        environment: [],
        volumes: [],
        endpoints: [],
        references: [],
    };
    // For AddContainer, extract image from second argument
    if (chain.rootMethod === 'AddContainer' && chain.rootArgs.length > 1) {
        service.image = extractFirstStringArg(chain.rootArgs[1]) || chain.rootArgs[1]?.replace(/["']/g, '');
    }
    // Process chained methods
    for (const method of chain.chainedMethods) {
        switch (method.method) {
            case 'WithImage':
                service.image = extractFirstStringArg(method.rawArgs) || undefined;
                break;
            case 'WithImageTag':
                service.imageTag = extractFirstStringArg(method.rawArgs) || undefined;
                break;
            case 'WithHostPort':
                const portArg = method.args[0];
                if (portArg) {
                    service.hostPort = parseInt(portArg, 10) || undefined;
                }
                break;
            case 'WithEnvironment':
                const env = extractEnvironment(method.args);
                if (env) {
                    service.environment.push(env);
                }
                break;
            case 'WithDataVolume':
                service.volumes.push({
                    isData: true,
                    mountPath: extractFirstStringArg(method.rawArgs) || undefined,
                });
                break;
            case 'WithBindMount':
                if (method.args.length >= 2) {
                    service.volumes.push({
                        isData: false,
                        name: extractFirstStringArg(method.args[0]) || method.args[0]?.replace(/["']/g, ''),
                        mountPath: extractFirstStringArg(method.args[1]) || method.args[1]?.replace(/["']/g, ''),
                    });
                }
                break;
            case 'WithHttpEndpoint':
                service.endpoints.push(extractHttpEndpoint(method.args, method.rawArgs));
                break;
            case 'WithHttpsEndpoint':
                service.endpoints.push({
                    ...extractHttpEndpoint(method.args, method.rawArgs),
                    protocol: 'https',
                });
                break;
            case 'WithExternalHttpEndpoints':
                service.endpoints.push({
                    protocol: 'http',
                    isExternal: true,
                });
                break;
            case 'WithReference':
                const refName = extractFirstStringArg(method.rawArgs) || method.args[0]?.replace(/["']/g, '');
                if (refName) {
                    service.references.push(refName);
                }
                break;
        }
    }
    return service;
}
function extractEnvironment(args) {
    if (args.length < 2)
        return null;
    const key = extractFirstStringArg(args[0]) || args[0].replace(/["']/g, '');
    const value = extractFirstStringArg(args[1]) || args[1].replace(/["']/g, '');
    // Check if value is an expression (reference to another variable)
    const isExpression = !args[1].includes('"') && !args[1].includes("'");
    return { key, value, isExpression };
}
function extractHttpEndpoint(args, rawArgs) {
    const namedArgs = extractNamedArgs(args);
    const endpoint = {
        protocol: 'http',
        isExternal: false,
    };
    // Parse port from first positional arg or named arg
    if (args[0] && !args[0].includes(':')) {
        const port = parseInt(args[0], 10);
        if (!isNaN(port)) {
            endpoint.port = port;
        }
    }
    // Parse named arguments
    if (namedArgs.port) {
        endpoint.port = parseInt(namedArgs.port, 10);
    }
    if (namedArgs.targetPort) {
        endpoint.targetPort = parseInt(namedArgs.targetPort, 10);
    }
    if (namedArgs.name) {
        endpoint.name = namedArgs.name;
    }
    if (namedArgs.env) {
        endpoint.envVariable = namedArgs.env;
    }
    if (namedArgs.isExternal === 'true') {
        endpoint.isExternal = true;
    }
    return endpoint;
}
//# sourceMappingURL=container.js.map