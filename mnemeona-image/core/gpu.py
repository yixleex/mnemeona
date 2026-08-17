from __future__ import annotations

import gc

import torch


def clear_torch_gpu() -> None:
    gc.collect()

    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
