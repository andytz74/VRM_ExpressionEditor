# Blush Overlay Integration Notes

This document describes how the extension runtime should apply blush overlay data produced by VRM Expression Editor.

## Purpose

Some expression presets can display a blush image attached to the character head.

This is not a VRM material, not a shape key, and not stored inside the VRM. It is a runtime-created transparent image plane parented to the head bone.

There is one shared blush image and transform setting per character. Each expression preset can enable or disable blush and define its own opacity.

## Meta Structure

Shared character-level blush settings:

```json
{
  "blush": {
    "image": "redFace.png",
    "y": 0.04,
    "z": 0.08,
    "scale": 0.28
  }
}
```

Expression preset-level blush usage:

```json
{
  "expressionPresets": [
    {
      "id": "emotion-0",
      "name": "Surprise",
      "parameters": {
        "BROW_Up": 0.6,
        "EYE_Open": 1.0
      },
      "blush": {
        "enabled": true,
        "opacity": 0.54
      },
      "rangeSlots": [
        {
          "id": "range-1",
          "threshold": 0.5,
          "parameters": {},
          "blush": {
            "enabled": true,
            "opacity": 0.3
          }
        }
      ]
    }
  ]
}
```

## Resource Path

The blush image is stored in the image folder:

```text
img/redFace.png
```

The extension should resolve `meta.blush.image` relative to the loaded character/resource package.

## Load-Time Setup

When a character is loaded:

```text
1. Load VRM.
2. Load character meta.
3. If meta.blush.image exists, load the image texture.
4. Create a transparent plane mesh.
5. Parent the plane to the VRM head bone.
6. Apply y / z / scale from meta.blush.
7. Keep the plane hidden until the active expression requires blush.
```

The blush plane should be attached to:

```js
const head = vrm.humanoid.getRawBoneNode("head");
head.add(blushPlane);
```

Suggested transform:

```js
blushPlane.position.set(0, meta.blush.y ?? 0, meta.blush.z ?? 0);
blushPlane.scale.setScalar(meta.blush.scale ?? 0.28);
```

Editor-side value assumptions:

```text
x = 0
y = 0.0 ~ 0.1
z = 0.0 ~ 0.2
scale = 0.0 ~ 1.0
opacity = 0.0 ~ 1.0
```

## Material Setup

Use a transparent unlit material:

```js
const material = new THREE.MeshBasicMaterial({
  map: blushTexture,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide
});
```

Recommended render order:

```js
blushPlane.renderOrder = 10;
```

If the blush appears behind the face or clips incorrectly, test:

```js
material.depthTest = false;
```

Use `depthTest = false` only if needed. It makes the image always draw over the model.

## Expression Application

When applying an expression preset:

```js
const preset = findExpressionPreset(activeExpressionId);
const blush = preset?.blush;

if (!meta.blush?.image || !blush?.enabled) {
  blushPlane.visible = false;
} else {
  blushPlane.visible = true;
  blushPlane.material.opacity = blush.opacity ?? 1;
}
```

## Range Slots

Expression presets may have sub-ranges in `rangeSlots`.

If the active expression value is between range slots, the extension should evaluate blush opacity with the same interpolation concept used for expression parameters.

Concept:

```text
expression value 0.0 -> base preset blush opacity
expression value reaches range slot threshold -> use/interpolate that range slot blush opacity
```

If a range slot has no blush data, fall back to the main preset blush setting.

## Transition Behavior

When changing expressions, blush opacity should transition with the same expression transition duration.

Example:

```text
previous opacity -> next opacity over expression transition time
```

Do not instantly pop the blush opacity unless expression transition duration is 0.

## Notes

- `meta.blush` is shared character-level image, position, and scale data.
- `expressionPresets[].blush.opacity` is per-expression opacity.
- `expressionPresets[].rangeSlots[].blush.opacity` is per-subslot opacity.
- The blush plane is runtime-only.
- The blush plane is not stored in the VRM.
- The extension does not need to modify the VRM file.
