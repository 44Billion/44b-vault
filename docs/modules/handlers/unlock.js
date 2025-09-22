import { getSessionPrivkeyFromSecureElement } from 'passkey-manager'
import { unlockSession } from 'session-manager'

async function unlock () {
  const bla = await getSessionPrivkeyFromSecureElement()
  const sessionPrivkey = bla.x
  await unlockSession(sessionPrivkey)
}
