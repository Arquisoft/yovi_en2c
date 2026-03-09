use crate::YBotRegistry;
use std::sync::Arc;

/// Shared application state for the bot server.
///
/// This struct holds the bot registry and is shared across all request handlers
/// via Axum's state extraction. It uses `Arc` internally to allow cheap cloning
/// for concurrent request handling.
#[derive(Clone)]
pub struct AppState {
    /// The registry of available bots, wrapped in Arc for thread-safe sharing.
    bots: Arc<YBotRegistry>,
}

impl AppState {
    /// Creates a new application state with the given bot registry.
    pub fn new(bots: YBotRegistry) -> Self {
        Self {
            bots: Arc::new(bots),
        }
    }

    /// Returns a clone of the Arc-wrapped bot registry.
    pub fn bots(&self) -> Arc<YBotRegistry> {
        Arc::clone(&self.bots)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{RandomBot, HeuristicBot, MinimaxBot, AlfaBetaBot, MonteCarloBot};
    use crate::bot_implementations::MonteCarloDifficulty;
    
    #[test]
    fn test_state_with_bot() {
        // Creamos un registro vacío y añadimos solo RandomBot
        let registry = YBotRegistry::new_empty()
            .with_bot(Arc::new(RandomBot));
        let state = AppState::new(registry);

        // Verificamos que tiene al menos un bot
        assert!(!state.bots().names().is_empty());
        assert_eq!(state.bots().names().len(), 1);
    }

    #[test]
    fn test_state_with_multiple_bots() {
        // Creamos un registro con varios bots específicos
        let registry = YBotRegistry::new_empty()
            .with_bot(Arc::new(RandomBot))
            .with_bot(Arc::new(HeuristicBot))
            .with_bot(Arc::new(MinimaxBot::new(None)));

        let state = AppState::new(registry);

        // Solo verificamos que tiene el número correcto de bots
        assert_eq!(state.bots().names().len(), 3);
    }

    #[test]
    fn test_state_with_all_bots() {
        // Verificamos que el registro por defecto tiene bots
        let registry = YBotRegistry::new();
        let state = AppState::new(registry);

        // Solo verificamos que tiene al menos 1 bot (y no está vacío)
        assert!(!state.bots().names().is_empty());
        assert!(state.bots().names().len() >= 1);
    }

    #[test]
    fn test_state_clone() {
        let registry = YBotRegistry::new_empty()
            .with_bot(Arc::new(RandomBot));
        let state = AppState::new(registry);
        let cloned = state.clone();

        // Both should reference the same underlying data
        assert_eq!(state.bots().names(), cloned.bots().names());
    }

    #[test]
    fn test_bots_arc_clone() {
        let registry = YBotRegistry::new_empty()
            .with_bot(Arc::new(RandomBot));
        let state = AppState::new(registry);
        let bots1 = state.bots();
        let bots2 = state.bots();

        // Both Arcs should point to the same registry
        assert_eq!(bots1.names(), bots2.names());
    }

    #[test]
    fn test_state_empty_registry() {
        // Probamos explícitamente con un registro vacío
        let registry = YBotRegistry::new_empty();
        let state = AppState::new(registry);

        assert!(state.bots().names().is_empty());
        assert_eq!(state.bots().names().len(), 0);
    }
}
