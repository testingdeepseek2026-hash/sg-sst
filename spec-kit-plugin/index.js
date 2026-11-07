/** @type {import('@deepseek-ai/dsh-plugin').PluginApply} */
export const inject = ['tools', 'services'];

/** @type {import('@deepseek-ai/dsh-plugin').PluginApply} */
export function apply(ctx, config) {
  console.log('=== PLUGIN LOADED ===');
  console.log('ctx:', Object.keys(ctx));
  console.log('ctx.tools:', ctx.tools);
  console.log('ctx.get("tools"):', ctx.get('tools'));
  console.log('ctx.services:', ctx.services ? Object.keys(ctx.services) : 'no services');
  
  // Check if tools is a service
  if (ctx.services && ctx.services.tools) {
    console.log('ctx.services.tools:', ctx.services.tools);
    console.log('ctx.services.tools.register:', typeof ctx.services.tools.register);
  }

  const tools = ctx.tools || ctx.get('tools') || (ctx.services && ctx.services.tools);
  
  console.log('Final tools:', tools);
  console.log('tools.register:', typeof tools?.register);

  // Try registering with the service
  if (tools && typeof tools.register === 'function') {
    console.log('Attempting to register tool...');
    const cleanup = tools.register({
      name: 'specKitTest',
      title: 'Test Spec Kit Tool',
      description: 'A simple test tool to verify plugin works',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Test message'
          }
        },
        required: ['message']
      },
      output: {
        schema: {
          type: 'string',
          description: 'Tool result message'
        },
        render: 'text',
        presentationMeta: {}
      },
      async invoke({ message }) {
        return `Test tool executed with message: ${message}`;
      }
    });
    console.log('Registration result:', cleanup);
    return cleanup;
  }

  return () => {};
}