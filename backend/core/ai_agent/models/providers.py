# 内置提供商名称列表
BUILTIN_PROVIDERS = [
    "deepseek",
    "aliyun",
    "siliconflow",
    "openrouter",
    "kimi",
    "zhipuai",
    "ollama"
]

PROVIDERS = {
    "deepseek": {
        "name": "deepseek",
        "url": "https://api.deepseek.com/v1",
        "key": "",
        "favoriteModels": {
            "chat": {
                "deepseek-chat": 128000,
                "deepseek-reasoner": 128000
            },
            "embedding": {},
            "other": {}
        }
    },
    "aliyun": {
        "name": "阿里云",
        "url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "key": "",
        "favoriteModels": {
            "chat": {
                "qwen3-max": 256000,
                "qwen-plus": 1000000,
                "qwen-flash": 1000000,
                "deepseek-v3.2": 131072,
                "deepseek-v3.2-exp": 131072,
                "deepseek-v3.1": 131072
            },
            "embedding": {
                "text-embedding-v4":{
                    "dimensions": 1024,
                    "max-tokens": False,
                    "per-max-tokens": 8192
                },
                "text-embedding-v3":{
                    "dimensions": 1024,
                    "max-tokens": False,
                    "per-max-tokens": 8192
                }
            },
            "other": {}
        }
    },
    "siliconflow": {
        "name": "硅基流动",
        "url": "https://api.siliconflow.cn/v1",
        "key": "",
        "favoriteModels": {
            "chat": {
                "deepseek-ai/DeepSeek-V3.2": 160000,
                "deepseek-ai/DeepSeek-V3.1-Terminus": 160000,
                "zai-org/GLM-4.6V": 128000,
                "moonshotai/Kimi-K2-Thinking": 256000,
                "MiniMaxAI/MiniMax-M2": 192000,
                "Qwen/Qwen3-Next-80B-A3B-Instruct": 256000,
                "Qwen/Qwen3-235B-A22B-Instruct-2507": 256000
            },
            "embedding": {
                "Qwen/Qwen3-Embedding-0.6B": {
                    "dimensions": 1024,
                    "max-tokens": 32000,
                    "per-max-tokens": False
                },
                "Qwen/Qwen3-Embedding-4B":{
                    "dimensions": 2560,
                    "max-tokens": 32000,
                    "per-max-tokens": False
                },
                "Qwen/Qwen3-Embedding-8B":{
                    "dimensions": 4096,
                    "max-tokens": 32000,
                    "per-max-tokens": False
                },
            },
            "other": {}
        }
    },
    "openrouter": {
        "name": "OpenRouter",
        "url": "https://openrouter.ai/api/v1",
        "key": "",
        "favoriteModels": {
            "chat": {
                "openai/gpt-5.2-chat": 128000,
                "openai/gpt-5.2-pro": 400000,
                "openai/gpt-5.2": 400000,
                "anthropic/claude-opus-4.5": 200000,
                "anthropic/claude-sonnet-4.5": 1000000,
                "google/gemini-3-flash-preview": 1050000,
                "google/gemini-3-pro-preview": 1050000,
                "x-ai/grok-4.1-fast": 2000000,
                "x-ai/grok-4": 256000,
                "xiaomi/mimo-v2-flash": 262000,
                "moonshotai/kimi-k2.5": 262100,
                "z-ai/glm-4.7": 202000,
                "z-ai/glm-4.7-flash": 200000,
                "minimax/minimax-m2-her": 65500,
                "minimax/minimax-m2": 196000,
                "deepseek/deepseek-v3.2": 163000,
                "qwen/qwen3-max": 256000
            },
            "embedding": {
                "qwen/qwen3-embedding-4b": {
                    "dimensions": 2560,
                    "max-tokens": 32000,
                    "per-max-tokens": False
                },
                "qwen/qwen3-embedding-8b": {
                    "dimensions": 4096,
                    "max-tokens": 32000,
                    "per-max-tokens": False
                }
            },
            "other": {}
        }
    },
    "kimi": {
        "name": "Kimi",
        "url": "https://api.moonshot.cn/v1",
        "key": "",
        "favoriteModels": {
            "chat": {
                "kimi-k2.5": 262144,
                "kimi-k2-0905-preview": 256000
            },
            "embedding": {},
            "other": {}
        }
    },
    "zhipuai": {
        "name": "智谱",
        "url": "https://open.bigmodel.cn/api/paas/v4/",
        "key": "",
        "favoriteModels": {
            "chat": {
                "glm-4.6": 200000,
                "glm-4.7": 200000
            },
            "embedding": {
                "embedding-3": {
                    "dimensions": 2048,
                    "max-tokens": 8000,
                    "per-max-tokens": False
                }
            },
            "other": {}
        }
    },
    "ollama": {
        "name": "ollama",
        "url": "http://127.0.0.1:11434",
        "key": "",
        "favoriteModels": {
            "chat": {},
            "embedding": {},
            "other": {}
        }
    }
}