/**
 * 全局流程配置。
 *
 * 启动流程相关的参数都集中在这里，改这里就能调整启动页行为，不用去动场景。
 */

export const GameConfig = {
    /**
     * 启动页加载完成后进入的第一个 3D 场景。
     *
     * 必须和 assets/Scenes 下的场景文件名完全一致（不带 .scene 后缀）。
     * 如果你在编辑器里把场景改名了，只要改这一处即可。
     */
    firstScene: 'ThirdPersonCharacter',

    /** 启动页最短停留时间（秒）。加载再快也至少显示这么久，避免 logo 一闪而过。 */
    minSplashDuration: 1.2,

    /**
     * 加载完成后自动进入的延迟（秒）。
     * 设为负数表示不自动进入，必须等玩家点击。
     */
    autoEnterDelay: 1.2,

    /** 预加载超时（秒）。超过这个时间即使没加载完也允许玩家手动进入，避免卡在启动页。 */
    preloadTimeout: 20,

    /** 版本号，显示在启动页底部。 */
    version: 'v0.0.1',
};

export default GameConfig;
