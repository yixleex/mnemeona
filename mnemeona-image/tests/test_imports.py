def test_core_imports():
    from core.config import load_config
    from core.models import GenerationRequest
    from core.registry import ProviderRegistry
    from providers.base import ImageProvider

    assert load_config()
    assert GenerationRequest(prompt="test").width == 768
    assert ImageProvider is not None
    assert ProviderRegistry is not None


def test_lcm_manifest():
    import json
    from pathlib import Path

    path = (
        Path(__file__).parents[1]
        / "providers"
        / "lcm"
        / "manifest.json"
    )

    manifest = json.loads(
        path.read_text(encoding="utf-8")
    )

    assert manifest["id"] == "lcm"
    assert manifest["module"] == "provider:LCMProvider"
