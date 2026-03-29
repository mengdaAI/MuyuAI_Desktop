const { systemPreferences, shell, desktopCapturer } = require('electron');

class PermissionService {
  _getAuthService() {
    return require('./authService');
  }

  async checkSystemPermissions() {
    const permissions = {
      microphone: 'unknown',
      screen: 'unknown',
      needsSetup: true
    };

    try {
      if (process.platform === 'darwin') {
        permissions.microphone = systemPreferences.getMediaAccessStatus('microphone');
        permissions.screen = systemPreferences.getMediaAccessStatus('screen');
        permissions.needsSetup = permissions.microphone !== 'granted' || permissions.screen !== 'granted';
      } else if (process.platform === 'win32') {
        // Windows 10/11 支持 getMediaAccessStatus('microphone')，
        // 返回值为 'granted' | 'denied' | 'not-determined'
        // 屏幕录制在 Windows 上由 getDisplayMedia 原生弹框处理，无需系统级授权检查
        try {
          permissions.microphone = systemPreferences.getMediaAccessStatus('microphone');
        } catch (_) {
          // 旧版 Windows 或不支持时降级为 granted
          permissions.microphone = 'granted';
        }
        permissions.screen = 'granted';
        permissions.needsSetup = permissions.microphone !== 'granted';
      } else {
        // Linux 等其他平台：权限由 getUserMedia 在运行时处理
        permissions.microphone = 'granted';
        permissions.screen = 'granted';
        permissions.needsSetup = false;
      }

      return permissions;
    } catch (error) {
      console.error('[Permissions] Error checking permissions:', error);
      return {
        microphone: 'unknown',
        screen: 'unknown',
        needsSetup: true,
        error: error.message
      };
    }
  }

  async requestMicrophonePermission() {
    try {
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('microphone');
        if (status === 'granted') {
          return { success: true, status: 'granted' };
        }
        const granted = await systemPreferences.askForMediaAccess('microphone');
        return { success: granted, status: granted ? 'granted' : 'denied' };
      } else if (process.platform === 'win32') {
        // Windows 不支持 askForMediaAccess，
        // 若当前状态为 denied，引导用户去系统设置手动开启
        let status = 'granted';
        try {
          status = systemPreferences.getMediaAccessStatus('microphone');
        } catch (_) {}
        if (status === 'denied') {
          await this.openSystemPreferences('microphone');
          return { success: false, status: 'denied' };
        }
        return { success: true, status };
      } else {
        return { success: true, status: 'granted' };
      }
    } catch (error) {
      console.error('[Permissions] Error requesting microphone permission:', error);
      return { success: false, error: error.message };
    }
  }

  async openSystemPreferences(section) {
    try {
      if (process.platform === 'darwin') {
        if (section === 'screen-recording') {
          // 不 await：getSources 在未授权时会静默阻塞（不抛出），若 await 会导致
          // shell.openExternal 永远无法执行，表现为点击按钮没有任何反应。
          // 此处仅 fire-and-forget，目的是让系统把 app 注册进屏幕录制权限列表。
          desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1, height: 1 }
          }).catch(() => {});
          await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
        } else if (section === 'microphone') {
          await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
        }
      } else if (process.platform === 'win32') {
        // Windows 10/11 隐私设置深链接
        if (section === 'microphone') {
          await shell.openExternal('ms-settings:privacy-microphone');
        } else if (section === 'screen-recording') {
          // Windows 不需要独立的屏幕录制权限，getDisplayMedia 会弹出原生选择器
          return { success: false, error: 'Screen recording permission is handled by Windows automatically' };
        }
      } else {
        return { success: false, error: 'Not supported on this platform' };
      }

      return { success: true };
    } catch (error) {
      console.error('[Permissions] Error opening system preferences:', error);
      return { success: false, error: error.message };
    }
  }
}

const permissionService = new PermissionService();
module.exports = permissionService; 