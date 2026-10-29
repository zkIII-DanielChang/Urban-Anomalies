import { builtinResMgr, Node, Sprite, SpriteFrame, Texture2D, tween, UIOpacity } from 'cc';

/**
 * 界面小工具。启动页用到的东西都放这里，和具体业务解耦。
 */

let _solidSpriteFrame: SpriteFrame | null = null;

/**
 * 取一张纯白的 SpriteFrame（来自引擎内置的 white-texture）。
 *
 * 用途：给没有指定贴图的 Sprite 兜底。白色底乘以 Sprite.color 就是任意纯色，
 * 所以启动页的色块即使丢了占位图也照样能显示。
 */
export function getSolidSpriteFrame(): SpriteFrame {
    if (!_solidSpriteFrame) {
        const texture = builtinResMgr.get<Texture2D>('white-texture');
        const frame = new SpriteFrame();
        frame.texture = texture;
        _solidSpriteFrame = frame;
    }
    return _solidSpriteFrame!;
}

/**
 * 递归给 root 下面所有没贴图的 Sprite 补上一张白色 SpriteFrame。
 *
 * 编辑器里能看到真实的贴图；这里只是防止贴图丢失后界面整个不显示（Sprite 无贴图时是空渲染）。
 */
export function ensureSolidSprites(root: Node | null): number {
    if (!root) return 0;
    let patched = 0;
    const visit = (node: Node) => {
        const sprite = node.getComponent(Sprite);
        if (sprite && !sprite.spriteFrame) {
            sprite.spriteFrame = getSolidSpriteFrame();
            patched++;
        }
        for (const child of node.children) visit(child);
    };
    visit(root);
    return patched;
}

/** 取节点上的 UIOpacity，没有就加一个。 */
export function opacityOf(node: Node): UIOpacity {
    return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
}

/** 立刻把节点透明度设为 value（0~255），不加动画。 */
export function setOpacity(node: Node | null, value: number): void {
    if (node) opacityOf(node).opacity = value;
}

/**
 * 淡入到指定透明度。
 * 返回 Promise，await 之后动画结束，方便串起「淡入 → 停顿 → 淡出」这种流程。
 */
export function fadeTo(node: Node | null, opacity: number, duration: number, delay = 0): Promise<void> {
    if (!node) return Promise.resolve();
    const comp = opacityOf(node);
    if (duration <= 0 && delay <= 0) {
        comp.opacity = opacity;
        return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
        tween(comp)
            .delay(delay)
            .to(duration, { opacity }, { easing: 'quadOut' })
            .call(() => resolve())
            .start();
    });
}

/** 等待若干秒。 */
export function wait(seconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
        if (seconds <= 0) resolve();
        else tween({ t: 0 }).delay(seconds).call(() => resolve()).start();
    });
}
