# Typed Rich Text

Notion has no native Vector3, CFrame, or Color3 columns. To store Roblox values in spreadsheets, use **Rich Text** columns with a bracket type annotation in the property name.

## Property name convention

```text
BaseName [TypeName]
```

Examples:

| Notion column | Luau key | Type |
| --- | --- | --- |
| `Position [Vector3]` | `Position` | `Vector3` |
| `Spawn [CFrame]` | `Spawn` | `CFrame` |
| `Tint [Color3]` | `Tint` | `Color3` |

The base name becomes the Luau property key. The `[TypeName]` suffix is stripped on pull and restored on push.

Unknown type names (for example `Position [UnknownType]`) are treated as plain Rich Text — the full column name is kept as the Luau key.

## Value formats

All values are plain text in Notion. Whitespace around commas is allowed.

| TypeName | Notion value example | Generated Luau |
| --- | --- | --- |
| `Vector2` | `10, 5` | `Vector2.new(10, 5)` |
| `Vector3` | `10, 5, -20` | `Vector3.new(10, 5, -20)` |
| `Color3` | `255, 128, 0` | `Color3.fromRGB(255, 128, 0)` |
| `UDim` | `0.5, 12` | `UDim.new(0.5, 12)` |
| `UDim2` | `0, 0, 1, 24` | `UDim2.new(0, 0, 1, 24)` |
| `Rect` | `0, 0, 100, 50` | `Rect.new(0, 0, 100, 50)` |
| `NumberRange` | `0, 100` | `NumberRange.new(0, 100)` |
| `CFrame` | `10, 5, -20 \| 0, 90, 0` | `CFrame.new(10, 5, -20) * CFrame.fromEulerAnglesYXZ(math.rad(0), math.rad(90), math.rad(0))` |

CFrame rotation uses **degrees** in **YXZ** order (Studio Orientation). The pipe `|` separates position from rotation.

## Fallback behavior

When a cell value cannot be parsed for the declared type, **that cell only** falls back to a plain string. Pull still succeeds. A warning is printed to stderr:

```text
Warning: Record "Sword" property "Position" [Vector3] could not be parsed; kept as string "bad".
```

When any record in a typed column falls back to string, generated `export type` uses a union (for example `Vector3 | string`).

## Push (`ntn-lua push`)

- Typed values in Luau are written back to Notion using the formats above.
- Notion column names are restored as `BaseName [TypeName]`.
- The reserved Title column remains **`Name`**. A Luau property named `Name` still conflicts with the title column and causes an error on push.

## Limitations

- Push recognizes canonical constructor syntax only (`Vector3.new(...)`, `Color3.fromRGB(...)`, CFrame with `fromEulerAnglesYXZ(math.rad(...))`, etc.).
- Functions, expressions, and userdata are not supported.
- `NumberSequence`, `ColorSequence`, and similar structured types are out of scope for v1.
