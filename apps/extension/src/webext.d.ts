/**
 * Minimal ambient typings for the slice of the WebExtension (`chrome.*`) API the
 * extension actually uses.
 *
 * We deliberately avoid a full `@types/chrome` dependency (AGENTS.md → minimal
 * dependencies) and declare only what is called here. The surface is the
 * cross-browser `chrome.*` namespace, so the extension stays portable.
 */
declare namespace chrome {
  namespace action {
    const onClicked: {
      addListener(callback: (tab: tabs.Tab) => void): void;
    };
  }

  namespace runtime {
    interface MessageSender {
      tab?: tabs.Tab;
      id?: string;
    }
    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
    }
    function query(queryInfo: {
      active?: boolean;
      currentWindow?: boolean;
    }): Promise<Tab[]>;
    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
  }

  namespace scripting {
    function executeScript(injection: {
      target: { tabId: number };
      files: string[];
    }): Promise<unknown>;
  }

  namespace sidePanel {
    function open(options: { tabId?: number; windowId?: number }): Promise<void>;
  }
}
