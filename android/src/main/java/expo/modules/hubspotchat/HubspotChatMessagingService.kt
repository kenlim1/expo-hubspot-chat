package expo.modules.hubspotchat

import com.google.firebase.messaging.RemoteMessage
import com.hubspot.mobilesdk.HubspotManager
import com.hubspot.mobilesdk.firebase.HubspotFirebaseMessagingService

class HubspotChatMessagingService : HubspotFirebaseMessagingService() {

  override fun onNewToken(token: String) {
    super.onNewToken(token)
  }

  override fun onMessageReceived(message: RemoteMessage) {
  }
}
