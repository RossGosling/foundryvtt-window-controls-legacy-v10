class WindowControls {

    static noLibWrapper = false;
    static externalMinimize = false;

    static minimizedStash = {};
    static cssMinimizedSize = 150;
    static cssMinimizedBottomHotbar = 70;
    static cssMinimizedBottomNoHotbar = 5;
    static cssTopBarLeftStart = 120;
    static cssBottomBarLeftStart = 160;

    static debouncedReload = debounce(() => window.location.reload(), 100);

    static positionMinimizeBar() {
        const rootStyle = document.querySelector(':root').style;
        const setting = game.settings.get('window-controls', 'organizedMinimize');
        const bar = $('#minimized-bar').hide();
        const barHtml = $(`<div id="minimized-bar" class="app" style="display: none;"></div>`);
        switch (setting) {
            case 'topBar': {
                rootStyle.setProperty('--minibarbot', 'unset');
                rootStyle.setProperty('--minibartop', (WindowControls.getTopPosition()-4)+'px');
                rootStyle.setProperty('--minibarleft', WindowControls.cssTopBarLeftStart + 'px');
                if (bar.length === 0)
                    barHtml.appendTo('body');
                break;
            }
            case 'bottomBar': {
                let hotbarSetting;
                if (game.modules.get('minimal-ui')?.active)
                    hotbarSetting = game.settings.get('minimal-ui', 'hotbar');
                if (hotbarSetting && (hotbarSetting === 'hidden' || (hotbarSetting === 'onlygm' && !game.user?.isGM)))
                    rootStyle.setProperty('--minibarbot', WindowControls.cssMinimizedBottomNoHotbar+'px');
                else
                    rootStyle.setProperty('--minibarbot', WindowControls.cssMinimizedBottomHotbar+'px');
                rootStyle.setProperty('--minibartop', 'unset');
                rootStyle.setProperty('--minibarleft', WindowControls.cssBottomBarLeftStart + 'px');
                if (bar.length === 0)
                    barHtml.appendTo('body');
                break;
            }
        }
    }

    static getTopPosition() {
        const minimizedSetting = game.settings.get('window-controls', 'organizedMinimize');
        if (['bottomBar', 'bottom'].includes(minimizedSetting)) {
            let hotbarSetting;
            if (game.modules.get('minimal-ui')?.active)
                hotbarSetting = game.settings.get('minimal-ui', 'hotbar');
            let availableHeight = parseInt($("#board").css('height'));
            if (hotbarSetting && (hotbarSetting === 'hidden' || (hotbarSetting === 'onlygm' && !game.user?.isGM)))
                return availableHeight - WindowControls.cssMinimizedBottomNoHotbar - 42;
            else
                return availableHeight - WindowControls.cssMinimizedBottomHotbar - 42;
        } else {
            let logoSetting;
            if (game.modules.get('minimal-ui')?.active)
                logoSetting = game.settings.get('minimal-ui', 'foundryLogoSize');
            let offset = document.querySelector("#navigation").offsetHeight + 20;
            // 65px is Rough estimate for standard logo size, to not overlap
            if (logoSetting && logoSetting === 'standard')
                offset = Math.max(65, offset);
            return offset;
        }
    }

    static getLeftPosition(app) {
        const minimizedSetting = game.settings.get('window-controls', 'organizedMinimize');
        const minGap = ['top', 'topBar'].includes(minimizedSetting) ? WindowControls.cssTopBarLeftStart + 10 : WindowControls.cssBottomBarLeftStart + 10;
        const sidebarGap = WindowControls.cssMinimizedSize * 4;
        const jumpGap = WindowControls.cssMinimizedSize + 10;
        const boardSize = parseInt($("#board").css('width'));
        const maxGap = boardSize - sidebarGap;
        let targetPos;
        for (let i = minGap; i < maxGap + jumpGap; i = i + jumpGap) {
            if (WindowControls.minimizedStash[i]?.app.appId === app.appId) {
                WindowControls.minimizedStash[i].oldPosition = Object.assign({}, app.position);
                targetPos = i;
                break;
            } else if (!targetPos && !WindowControls.minimizedStash[i]?.app.rendered) {
                WindowControls.minimizedStash[i] = {app: app, oldPosition: Object.assign({}, app.position)};
                targetPos = i;
                break;
            }
        }
        return targetPos;
    }

    static setMinimizedPosition(app) {
        WindowControls.cleanupStash();
        const leftPos = WindowControls.getLeftPosition(app);
        const topPos = WindowControls.getTopPosition();
        app.setPosition({
            left: leftPos ?? app.position.left,
            top: topPos ?? app.position.top,
            width: WindowControls.cssMinimizedSize
        });
    }

    static setRestoredPosition(app) {
        const minimizedStash = Object.values(WindowControls.minimizedStash);
        const matchedStash = minimizedStash.find(a => a.app.appId === app?.appId);
        app.setPosition(matchedStash?.oldPosition ?? app.position);
    }

    static cleanupStash() {
        const appIds = [];
        Object.keys(WindowControls.minimizedStash).forEach(i => {
            const stash = WindowControls.minimizedStash[i];
            if (!stash.app?.rendered || appIds.includes(stash.app?.appId)) {
                delete WindowControls.minimizedStash[i];
            } else if (stash.app){
                appIds.push(stash.app.appId);
            }
        });
    }

    static refreshMinimizeBar() {
        const minimized = $(".minimized");
        const bar = $("#minimized-bar");
        const stashSize = Object.keys(WindowControls.minimizedStash).length;
        if (minimized.length === 0) {
            WindowControls.minimizedStash = {};
            bar.hide();
        } else if (stashSize > 0) {
            if (stashSize === 1)
                WindowControls.positionMinimizeBar();
            WindowControls.cleanupStash();
            const maxPosition = Math.max(
                ...Object.entries(WindowControls.minimizedStash)
                    .filter(([_, app]) => app.app.rendered && app.app._minimized)
                    .map(([pos, _]) => Number(pos))
                    .concat(0)
            );
            const setting = game.settings.get('window-controls', 'organizedMinimize');
            const rootStyle = document.querySelector(':root').style;
            if (setting === 'topBar') {
                rootStyle.setProperty('--minibarw', maxPosition + 40 + 'px');
            } else
                rootStyle.setProperty('--minibarw', maxPosition + 'px');
            minimized.show();
            bar.show();
        }
    }

    static cleanupMinimizeBar(app, force) {
        const minimizedApps = $(".minimized").toArray();
        const matchedStash = minimizedApps.find(a => $(a).attr('data-appid') == app?.appId);
        if (matchedStash) {
            $(matchedStash).css('visibility', 'hidden');
            WindowControls.setRestoredPosition(app);
            WindowControls.setRestoredStyle(app);
        } else if (force) {
            Object.values(WindowControls.minimizedStash).forEach(stashed => {
                WindowControls.setRestoredPosition(stashed.app);
                WindowControls.setRestoredStyle(stashed.app);
            });
        }
        if (force || (minimizedApps.length === 0) || (minimizedApps.length === 1 && matchedStash)) {
            $("#minimized-bar").hide();
            WindowControls.minimizedStash = {};
        } else if (matchedStash) {
            WindowControls.refreshMinimizeBar();
        }
    }

    static setMinimizedStyle(app) {
        app.element.find(".minimize").empty();
        app.element.find(".minimize").append(`<i class="far fa-window-restore"></i>`);
        app.element.find(".minimize").show();
    }

    static setRestoredStyle(app) {
        app.element.find(".minimize").empty();
        app.element.find(".minimize").append(`<i class="far fa-window-minimize"></i>`);
    }

    static applyPinnedMode(app) {
        const header = app.element.find(".window-header");
        if (header.hasClass('minimized-pinned')) {
            header.removeClass('minimized-pinned');
            app.close = app.closeBKP;
            delete app.closeBKP;
            app.element.find(".window-header")
                .append($(`<a class="header-button close"><i class="fas fa-times"></i></a>`)
                    .click(function() {app.close()}));
        } else {
            header.addClass('minimized-pinned');
            app.element.find(".close").remove();
            app.closeBKP = app.close;
            app.close = function() {if (!app._minimized) app.minimize()};
        }
    }

    static reapplyMaximize(app, h, w) {
        app.setPosition({
            width: w - (ui.sidebar._collapsed ? 50 : 325),
            height: h - 15,
            left: 10,
            top: 3
        });
    }

    static maximizeWindow(app) {
        if (app._maximized) {
            app.setPosition(app._maximized);
            app.element
                .find(".fa-window-restore")
                .removeClass('fa-window-restore')
                .addClass('fa-window-maximize');
            delete app._maximized;
        } else {
            const board = $("#board");
            const availableHeight = parseInt(board.css('height'));
            const availableWidth = parseInt(board.css('width'));
            app._maximized = {};
            Object.assign(app._maximized, app.position);
            WindowControls.reapplyMaximize(app, availableHeight, availableWidth);
            WindowControls.reapplyMaximize(app, availableHeight, availableWidth);
            app.element
                .find(".fa-window-maximize")
                .removeClass('fa-window-maximize')
                .addClass('fa-window-restore');
        }
    }

    static initSettings() {
        game.settings.register('window-controls', 'minimizeButton', {
            name: game.i18n.localize("WindowControls.MinimizeButtonName"),
            hint: game.i18n.localize("WindowControls.MinimizeButtonHint"),
            scope: 'world',
            config: true,
            type: String,
            choices: {
                "enabled": game.i18n.localize("WindowControls.Enabled"),
                "disabled": game.i18n.localize("WindowControls.Disabled")
            },
            default: "enabled",
            onChange: WindowControls.debouncedReload
        });
        game.settings.register('window-controls', 'organizedMinimize', {
            name: game.i18n.localize("WindowControls.OrganizedMinimizeName"),
            hint: game.i18n.localize("WindowControls.OrganizedMinimizeHint"),
            scope: 'world',
            config: true,
            type: String,
            choices: {
                "bottom": game.i18n.localize("WindowControls.OrganizedMinimizeBottom"),
                "bottomBar": game.i18n.localize("WindowControls.OrganizedMinimizeBottomBar"),
                "top": game.i18n.localize("WindowControls.OrganizedMinimizeTop"),
                "topBar": game.i18n.localize("WindowControls.OrganizedMinimizeTopBar"),
                "disabled": game.i18n.localize("WindowControls.Disabled")
            },
            default: "topBar",
            onChange: WindowControls.debouncedReload
        });
        game.settings.register('window-controls', 'pinnedButton', {
            name: game.i18n.localize("WindowControls.PinnedButtonName"),
            hint: game.i18n.localize("WindowControls.PinnedButtonHint"),
            scope: 'world',
            config: true,
            type: String,
            choices: {
                "enabled": game.i18n.localize("WindowControls.Enabled"),
                "disabled": game.i18n.localize("WindowControls.Disabled")
            },
            default: "disabled",
            onChange: WindowControls.debouncedReload
        });
        game.settings.register('window-controls', 'maximizeButton', {
            name: game.i18n.localize("WindowControls.MaximizeButtonName"),
            hint: game.i18n.localize("WindowControls.MaximizeButtonHint"),
            scope: 'world',
            config: true,
            type: String,
            choices: {
                "enabled": game.i18n.localize("WindowControls.Enabled"),
                "disabled": game.i18n.localize("WindowControls.Disabled")
            },
            default: "disabled",
            onChange: WindowControls.debouncedReload
        });
    }

    static initHooks() {

        Hooks.once('ready', async function() {
            libWrapper.register('window-controls', 'KeyboardManager.prototype._onEscape', function (wrapped, ...args) {
                let [_, up, modifiers] = args;
                if ( up || modifiers.hasFocus ) return wrapped(...args);
                else if ( $(".minimized-pinned").length === 0 && !(ui.context && ui.context.menu.length) ) {
                    if (  Object.keys(WindowControls.minimizedStash).length > 0) {
                        WindowControls.cleanupMinimizeBar(undefined, true);
                    }
                }
                return wrapped(...args);
            }, 'WRAPPER');

            const settingOrganized = game.settings.get('window-controls', 'organizedMinimize');
            if (settingOrganized !== 'disabled') {
                libWrapper.register('window-controls', 'Application.prototype.minimize', async function (wrapped, ...args) {
                    const targetHtml = $(`[data-appid='${this.appId}']`);
                    targetHtml.css('visibility', 'hidden');
                    const result = await wrapped(...args);
                    WindowControls.setMinimizedPosition(this);
                    WindowControls.setMinimizedStyle(this);
                    WindowControls.refreshMinimizeBar();
                    targetHtml.css('visibility', '');
                    return result;
                }, 'WRAPPER');

                libWrapper.register('window-controls', 'Application.prototype.maximize', async function (wrapped, ...args) {
                    const targetHtml = $(`[data-appid='${this.appId}']`);
                    targetHtml.css('visibility', 'hidden');
                    const result = await wrapped(...args);
                    WindowControls.setRestoredPosition(this);
                    WindowControls.refreshMinimizeBar();
                    WindowControls.setRestoredStyle(this);
                    targetHtml.css('visibility', '');
                    return result;
                }, 'WRAPPER');
            }

            libWrapper.register('window-controls', 'Application.prototype._getHeaderButtons', function (wrapped, ...args) {
                let result = wrapped(...args);
                const close = result.find(b => b.class === 'close');
                close.label = '';
                const newButtons = [];
                const minimizeSetting = game.settings.get('window-controls', 'minimizeButton');
                if (minimizeSetting === 'enabled') {
                    const minimizeButton = {
                        label: "",
                        class: "minimize",
                        icon: "far fa-window-minimize",
                        onclick: () => {
                            if (this._minimized)
                                this.maximize();
                            else
                                this.minimize();
                        }
                    };
                    newButtons.push(minimizeButton)
                }
                const maximizeSetting = game.settings.get('window-controls', 'maximizeButton');
                if (maximizeSetting === 'enabled' && this.options.resizable) {
                    const maximizeButton = {
                        label: "",
                        class: "maximize",
                        icon: this._maximized ? "far fa-window-restore" : "far fa-window-maximize",
                        onclick: () => {
                            WindowControls.maximizeWindow(this)
                        }
                    }
                    newButtons.push(maximizeButton)
                }
                const pinnedSetting = game.settings.get('window-controls', 'pinnedButton');
                if (pinnedSetting === 'enabled') {
                    const pinButton = {
                        label: "",
                        class: "pin",
                        icon: "fas fa-map-pin",
                        onclick: () => {
                            WindowControls.applyPinnedMode(this)
                        }
                    }
                    newButtons.push(pinButton)
                }
                return newButtons.concat(result)
            }, 'WRAPPER');


        });

        Hooks.on('closeSidebarTab', function(app) {
            WindowControls.cleanupMinimizeBar(app);
        });

        Hooks.on('closeApplication', function(app) {
            WindowControls.cleanupMinimizeBar(app);
        });

        Hooks.on('closeItemSheet', function(app) {
            WindowControls.cleanupMinimizeBar(app);
        });

        Hooks.on('closeActorSheet', function(app) {
            WindowControls.cleanupMinimizeBar(app);
        });

    }

}

Hooks.once('init', () => {
    if (!game.modules.get('lib-wrapper')?.active) {
        WindowControls.noLibWrapper = true;
    }
    if (game.modules.get('minimize-button')?.active) {
        WindowControls.externalMinimize = true;
    }

    if (!(WindowControls.noLibWrapper || WindowControls.externalMinimize)) {
        WindowControls.initSettings();
        WindowControls.initHooks();
    }
});

Hooks.once('ready', () => {

    if (WindowControls.noLibWrapper && game.user.isGM)
        ui.notifications.error("Window Controls: Disabled Minimize Feature because 'lib-wrapper' module is not active.");

    if (WindowControls.externalMinimize && game.user.isGM)
        ui.notifications.error("Window Controls: Disabled Minimize Feature because 'Minimize Button' module is active and is not compatible.");

    const rootStyle = document.querySelector(':root').style;
    if (game.modules.get('minimal-ui')?.active) {
        rootStyle.setProperty('--wcbordercolor', game.settings.get('minimal-ui', 'borderColor'));
        rootStyle.setProperty('--wcshadowcolor', game.settings.get('minimal-ui', 'shadowColor'));
        rootStyle.setProperty('--wcshadowstrength', game.settings.get('minimal-ui', 'shadowStrength') + 'px');
    } else {
        rootStyle.setProperty('--wcbordercolor', '#ff640080');
    }

})


