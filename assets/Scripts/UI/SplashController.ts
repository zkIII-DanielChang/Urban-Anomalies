import { _decorator, Component, director, input, Input, Label, Node, ProgressBar } from 'cc';
import { GameConfig } from '../Core/GameConfig';
import { ensureSolidSprites, fadeTo, setOpacity } from './UiKit';

const { ccclass, property } = _decorator;

/** 启动页状态机。 */
type SplashState = 'loading' | 'ready' | 'entering';

/**
 * 启动页控制器。
 *
 * 流程：淡入标题 → 后台预加载第一个 3D 场景（进度条同步） → 加载完成后出现「开始调查」按钮。
 * 整屏都可以点，加载失败或超时也不会卡死，玩家总能进场景。
 */
@ccclass('SplashController')
export class SplashController extends Component {
    @property({ type: ProgressBar, tooltip: '加载进度条' })
    public progressBar: ProgressBar | null = null;

    @property({ type: Label, tooltip: '进度百分比文字' })
    public progressLabel: Label | null = null;

    @property({ type: Label, tooltip: '状态提示文字' })
    public statusLabel: Label | null = null;

    @property({ type: Label, tooltip: '版本号文字' })
    public versionLabel: Label | null = null;

    @property({ type: Node, tooltip: '标题区域，开场淡入' })
    public titleGroup: Node | null = null;

    @property({ type: Node, tooltip: '底部区域（进度条、按钮），稍后淡入' })
    public bottomGroup: Node | null = null;

    @property({ type: Node, tooltip: '开始按钮，加载完成后出现' })
    public startButton: Node | null = null;

    @property({ type: Node, tooltip: '全屏遮罩，切场景前淡出用' })
    public fadeOverlay: Node | null = null;

    private _state: SplashState = 'loading';
    private _elapsed = 0;
    private _minTimePassed = false;
    private _loaded = false;
    private _timedOut = false;
    private _loadError: Error | null = null;
    private _targetProgress = 0;
    private _shownProgress = 0;

    protected onLoad(): void {
        // Sprite 没有贴图时是空渲染。这里兜底，保证色块在任何情况下都显示。
        ensureSolidSprites(this.node.scene);

        if (this.fadeOverlay) this.fadeOverlay.active = false;
        setOpacity(this.titleGroup, 0);
        setOpacity(this.bottomGroup, 0);
        if (this.startButton) {
            this.startButton.active = false;
            setOpacity(this.startButton, 0);
        }
        if (this.progressBar) this.progressBar.progress = 0;
        if (this.progressLabel) this.progressLabel.string = '0%';
        if (this.versionLabel) this.versionLabel.string = GameConfig.version;
        this.setStatus(`正在载入 · ${GameConfig.firstScene}`);

        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    protected start(): void {
        this.logLaunchInfo();
        void this.playIntro();
        this.startPreload();
    }

    protected update(dt: number): void {
        this._elapsed += dt;

        if (!this._minTimePassed && this._elapsed >= GameConfig.minSplashDuration) {
            this._minTimePassed = true;
            this.tryBecomeReady();
        }
        if (!this._timedOut && !this._loaded && this._elapsed >= GameConfig.preloadTimeout) {
            this._timedOut = true;
            this.setStatus('加载较慢，可直接进入');
            this.tryBecomeReady();
        }

        // 进度条平滑追上去，避免数值一格一格跳。
        const goal = this._loaded ? 1 : this._targetProgress;
        const k = Math.min(1, dt * 10);
        this._shownProgress += (goal - this._shownProgress) * k;
        this.applyProgress(this._shownProgress);
    }

    // ------------------------------------------------------------------ 表现

    private async playIntro(): Promise<void> {
        await fadeTo(this.titleGroup, 255, 0.55);
        await fadeTo(this.bottomGroup, 255, 0.4, 0.05);
    }

    private applyProgress(value: number): void {
        const clamped = Math.max(0, Math.min(1, value));
        if (this.progressBar) this.progressBar.progress = clamped;
        if (this.progressLabel) this.progressLabel.string = `${Math.round(clamped * 100)}%`;
    }

    private setStatus(text: string): void {
        if (this.statusLabel) this.statusLabel.string = text;
    }

    // ------------------------------------------------------------------ 加载

    private startPreload(): void {
        const target = GameConfig.firstScene;
        const current = director.getScene();

        if (!target) {
            this.fail(new Error('GameConfig.firstScene 未配置'));
            return;
        }
        if (current && current.name === target) {
            // 直接在目标场景里按预览时的兜底，避免自己加载自己。
            this.fail(new Error(`当前已在场景 ${target}，无法再加载它自己`));
            return;
        }

        director.preloadScene(
            target,
            (finished: number, total: number) => {
                this._targetProgress = total > 0 ? finished / total : 0;
            },
            (err: Error | null) => {
                if (err) {
                    this.fail(err);
                    return;
                }
                this._loaded = true;
                this._targetProgress = 1;
                this.tryBecomeReady();
            },
        );
    }

    private fail(err: Error): void {
        this._loadError = err;
        console.error('[Splash] 预加载失败:', err);
        this.setStatus('场景未加入构建列表');
        this.tryBecomeReady();
    }

    private tryBecomeReady(): void {
        if (this._state !== 'loading') return;
        if (!this._minTimePassed) return;
        if (!this._loaded && !this._timedOut && !this._loadError) return;

        this._state = 'ready';
        this.setStatus(this._loadError ? '轻触屏幕重试' : '');

        if (this.startButton) {
            this.startButton.active = true;
            setOpacity(this.startButton, 0);
            void fadeTo(this.startButton, 255, 0.35);
        }

        const delay = GameConfig.autoEnterDelay;
        if (delay >= 0 && !this._loadError) {
            this.scheduleOnce(() => { void this.enter(); }, delay);
        }
    }

    // ------------------------------------------------------------------ 进入

    private onTouchEnd(): void {
        void this.enter();
    }

    private onKeyUp(): void {
        void this.enter();
    }

    private async enter(): Promise<void> {
        if (this._state !== 'ready') return;
        this._state = 'entering';
        this.unscheduleAllCallbacks();
        this.setStatus('进入中…');

        if (this.fadeOverlay) {
            this.fadeOverlay.active = true;
            setOpacity(this.fadeOverlay, 0);
            await fadeTo(this.fadeOverlay, 255, 0.28);
        }

        const target = GameConfig.firstScene;
        if (!target) return;

        director.loadScene(target, (err: Error | null) => {
            if (!err) return;
            // 加载失败就退回启动页，别把玩家卡在黑屏。
            console.error('[Splash] 进入场景失败:', err);
            this._state = 'ready';
            this.setStatus('进入失败，轻触重试');
            if (this.fadeOverlay) {
                void fadeTo(this.fadeOverlay, 0, 0.2).then(() => {
                    if (this.fadeOverlay) this.fadeOverlay.active = false;
                });
            }
        });
    }

    // ------------------------------------------------------------------ 平台

    private logLaunchInfo(): void {
        const wx = (globalThis as { wx?: any }).wx;
        if (!wx || typeof wx.getLaunchOptionsSync !== 'function') return;
        try {
            const options = wx.getLaunchOptionsSync();
            console.log(`[Splash] 微信启动参数 scene=${options?.scene} query=${JSON.stringify(options?.query ?? {})}`);
        } catch (e) {
            console.warn('[Splash] 读取微信启动参数失败', e);
        }
    }
}
