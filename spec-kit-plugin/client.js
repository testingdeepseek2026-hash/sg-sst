window.__ModuleLoader__.load({
  id: '@local/spec-kit',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    function SpecKitStatus() {
      return h('div', {
        style: {
          padding: '8px 12px',
          borderRadius: '6px',
          background: 'var(--dsw-alias-surface-secondary)',
          border: '1px solid var(--dsw-alias-border-subtle)',
          fontSize: '12px',
          color: 'var(--dsw-alias-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }
      }, [
        h('svg', {
          key: 'icon',
          viewBox: '0 0 24 24',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          style: { color: 'var(--dsw-alias-accent-primary)' }
        }, h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', key: 'doc' })),
        h('span', { key: 'text' }, 'Spec Kit ready'),
      ]);
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // Register a status indicator in the conversation composer dock area
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'spec-kit-status',
          order: 10,
        }, SpecKitStatus));

        // Also add a command palette entry for quick access to Spec Kit commands
        ctx.slots.inject('command.palette', () => ctx.slots.register({
          name: 'command.palette',
          id: 'spec-kit-commands',
          order: 50,
        }, (props) => {
          // This would register commands in the command palette
          // For now, just return null as we're primarily a tool provider
          return null;
        }));
      },
    };
  },
});