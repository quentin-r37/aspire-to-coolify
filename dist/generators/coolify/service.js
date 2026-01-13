/**
 * Service command generator for Coolify
 */
const ASPIRE_TO_COOLIFY_SERVICE = {
    minio: 'minio',
    rabbitmq: 'rabbitmq',
    keycloak: 'keycloak',
    seq: 'seq',
    maildev: 'mailpit', // Coolify uses mailpit instead of maildev
    kafka: 'kafka',
    elasticsearch: 'elasticsearch',
    custom: 'custom',
};
export function generateServiceCommand(service) {
    const coolifyType = ASPIRE_TO_COOLIFY_SERVICE[service.type] || 'custom';
    const args = [
        `--name "${service.name}"`,
        `--type ${coolifyType}`,
    ];
    // Add custom image if specified (especially for custom services)
    if (service.image) {
        const imageWithTag = service.imageTag ? `${service.image}:${service.imageTag}` : service.image;
        args.push(`--image "${imageWithTag}"`);
    }
    // Add public port if specified
    if (service.hostPort) {
        args.push(`--public-port ${service.hostPort}`);
    }
    // Add environment variables
    const envVars = {};
    for (const env of service.environment) {
        envVars[env.key] = env.value;
        args.push(`--env "${env.key}=${env.value}"`);
    }
    return {
        command: 'service:create',
        type: coolifyType,
        name: service.name,
        image: service.image ? (service.imageTag ? `${service.image}:${service.imageTag}` : service.image) : undefined,
        envVars,
        args,
        comment: `Service: ${service.name} (${service.type})`,
    };
}
export function generateStorageCommand(storage) {
    const args = [
        `--name "${storage.name}"`,
        `--type minio`,
    ];
    // Add custom image if specified
    if (storage.image) {
        const imageWithTag = storage.imageTag ? `${storage.image}:${storage.imageTag}` : storage.image;
        args.push(`--image "${imageWithTag}"`);
    }
    // Add public port if specified
    if (storage.hostPort) {
        args.push(`--public-port ${storage.hostPort}`);
    }
    // Add environment variables
    const envVars = {};
    for (const env of storage.environment) {
        envVars[env.key] = env.value;
        args.push(`--env "${env.key}=${env.value}"`);
    }
    return {
        command: 'service:create',
        type: 'minio',
        name: storage.name,
        image: storage.image ? (storage.imageTag ? `${storage.image}:${storage.imageTag}` : storage.image) : undefined,
        envVars,
        args,
        comment: `Storage: ${storage.name} (${storage.type})`,
    };
}
//# sourceMappingURL=service.js.map