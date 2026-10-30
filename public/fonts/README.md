# JetBrains Maple Mono web font

界面内置的等宽字体，来自 JetBrains Maple Mono 项目：

- 项目地址：https://github.com/SpaceTimee/Fusion-JetBrainsMapleMono
- 版本：`1.2304.79`
- 原始字面：`JetBrainsMapleMono-Regular.ttf`
- 许可证：SIL Open Font License 1.1，见 `JetBrainsMapleMono-OFL.txt`

字体未做子集化，使用 fontTools 4.63.0 转换为 woff2：

```sh
uvx --from 'fonttools[woff]==4.63.0' fonttools ttLib.woff2 compress \
  JetBrainsMapleMono-Regular.ttf \
  -o JetBrainsMapleMono-Regular-1.2304.79.woff2
```

SHA-256：

```text
d88f1b5e5e925f419076024ea74d141f7c926376e40459fd1eafa8ab585a9fb5  JetBrainsMapleMono-Regular-1.2304.79.woff2
6728aae70e0be6316b28681c5a806827b4d7daafe45fb767b932c790216c2533  JetBrainsMapleMono-OFL.txt
```
