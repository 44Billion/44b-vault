import { config, languages } from 'config'
import { toKebabCase } from 'helpers/string.js'

const locales = {
  // header
  vaultName: { en: 'Secure Login', pt: 'Login Seguro', hasDomNode: true },
  copyNsec: { en: 'Copy Private Key', pt: 'Copiar Chave Privada', hasDomNode: true },
  nsecCopiedSuccessfully: { en: 'Private key copied to clipboard', pt: 'Chave privada copiada para área de transferência' },
  nsecCopyError: { en: 'Failed to copy private key', pt: 'Falha ao copiar chave privada' },
  authenticationRequired: { en: 'Authentication required to copy private key', pt: 'Autenticação necessária para copiar chave privada' },
  authenticationFailedDueToInactivity: { en: 'You took too long to authenticate. Try Again', pt: 'Você demorou muito na autenticação. Tente novamente' },
  noAccountsFound: { en: 'No accounts found', pt: 'Nenhuma conta encontrada' },
  loadingAccounts: { en: 'Loading accounts...', pt: 'Carregando contas...' },
  errorLoadingAccounts: { en: 'Error loading accounts', pt: 'Erro ao carregar contas' },
  clickToCopyNpub: { en: 'Click to copy public key', pt: 'Clique para copiar chave pública' },
  npubCopied: { en: 'Copied!', pt: 'Copiado!' },
  copyFailed: { en: 'Copy failed', pt: 'Falha ao copiar' },
  back: { en: 'Back', pt: 'Voltar', hasDomNode: true },
  // /
  updateAvailable: { en: 'New Version Available!', pt: 'Nova Versão Disponível!', hasDomNode: true },
  refresh: { en: 'Refresh', pt: 'Atualizar', hasDomNode: true },
  newAccount: { en: 'New Account', pt: 'Nova Conta', hasDomNode: true },

  addAccount: { en: 'Add Existing Account', pt: 'Adicionar Conta Existente', hasDomNode: true },
  addAccountWithPasskey: { en: 'Sign In', pt: 'Entrar', hasDomNode: true },
  addAccountWithNsec: { en: 'Paste Account Key (nsec)', pt: 'Digitar Chave de Conta (nsec)', hasDomNode: true },
  loadAccountDescription: {
    en: 'We will retrieve your account from your device\'s secure storage and add it to this session.',
    pt: 'Vamos recuperar sua conta do armazenamento seguro do dispositivo e adicioná-la a esta sessão.',
    hasDomNode: true
  },
  shortLoadAccountDescription: {
    en: 'Access account using biometrics.',
    pt: 'Acessar conta já armazenada',
    hasDomNode: true
  },
  createNewAccountDescription: {
    en: 'Create a brand new account',
    pt: 'Criar uma conta novinha em folha',
    hasDomNode: true
  },
  loadAccountButton: { en: 'Load My Account', pt: 'Carregar Minha Conta', hasDomNode: true },
  nsecInputLabel: { en: 'Enter your private key (nsec or hex):', pt: 'Digite sua chave privada (nsec ou hex):', hasDomNode: true },
  nsecInputPlaceholder: { en: 'nsec1... or hex private key', pt: 'nsec1... ou chave privada em hex', hasDomNode: true, domAttributes: ['placeholder'] },
  addAccountWithNsecButton: { en: 'Add Account', pt: 'Adicionar Conta', hasDomNode: true },

  backupKeys: { en: 'Backup Accounts', pt: 'Fazer Backup das Contas', hasDomNode: true },
  permissions: { en: 'Permissions', pt: 'Permissões', hasDomNode: true },
  logout: { en: 'Log Out', pt: 'Sair', hasDomNode: true },
  // /logout
  logoutAccount: { en: 'Log Account Out', pt: 'Sair da Conta' },
  // /info
  isVaultSecure: { en: 'What makes "Secure Login" a secure credential vault?', pt: 'O que torna o "Login Seguro" um cofre de credenciais realmente seguro?', hasDomNode: true },
  vaultSecurityExplanation1: { en: 'Your user credentials are stored on the device\'s Secure Element chip.', pt: 'Suas credenciais de usuário são salvas no chip seguro SE do dispositivo.', hasDomNode: true },
  vaultSecurityExplanation2: { en: 'The vault is loaded in a sandboxed iframe with browser\'s cross-domain security policies.', pt: 'O "Login Seguro" é carregado em um iframe isolado pelas políticas de segurança do navegador para domínios distintos.', hasDomNode: true },
  vaultSecurityExplanation3: { en: 'Its code is open-source, easily auditable and hosted by Github Pages without modifications.', pt: 'Seu código é aberto, facilmente auditável e hospedado no Github Pages sem alterações.', hasDomNode: true },
  vaultSecurityExplanation4: { en: 'Anyone can host it under their own Github user or elsewhere.', pt: 'Qualquer pessoa pode hospedá-lo sob seu próprio usuário Github ou em servidor próprio.', hasDomNode: true },
  readMore: { en: 'Read More', pt: 'Leia Mais', hasDomNode: true },
  // /new-account
  displayName: { en: 'Account Name', pt: 'Nome da Conta', hasDomNode: true },
  displayNamePlaceholder: { en: 'My Nickname', pt: 'Meu Apelido', hasDomNode: true, domAttributes: ['placeholder'] },
  createAccount: { en: 'Create Account', pt: 'Criar Conta', hasDomNode: true },
  createAccountError: { en: 'Error creating account', pt: 'Erro ao criar conta' },
  displayNameRequired: { en: 'Name is required', pt: 'Nome é obrigatório' },
  // /lock
  nameAccountGroup: { en: 'Give a name to this account group:', pt: 'Dê um nome p/ este grupo de contas:', hasDomNode: true },
  accountGroupDescription: { en: 'I Use These For Fun', pt: 'Uso para Diversão', hasDomNode: true, domAttributes: ['placeholder'] },
  // overlay messages
  successMessage: { en: 'Success', pt: 'Sucesso', hasDomNode: true },
  ok: { en: 'OK', pt: 'OK', hasDomNode: true },
  errorMessage: { en: 'Error', pt: 'Erro', hasDomNode: true },
  close: { en: 'Close', pt: 'Fechar', hasDomNode: true },
  accountLoadedSuccessfully: { en: 'Account loaded successfully', pt: 'Conta carregada com sucesso' },
  accountLoadError: { en: 'Error loading account', pt: 'Erro ao carregar conta' },
  nsecRequired: { en: 'Private key (nsec) is required', pt: 'Chave privada (nsec) é obrigatória' },
  invalidNsec: { en: 'Invalid private key format', pt: 'Formato de chave privada inválido' },
  passkeyStoreFailed: { en: 'Failed to securely store private key', pt: 'Falha ao armazenar chave privada com segurança' },
  // modules/messenger.js
  reqIdTypeError: { en: 'reqId field must be a string', pt: 'Campo reqId precisa ser textual' },
  unknownMessageCodeError: { en: 'Unknown message code', pt: 'O "code" da mensagem é desconhecido' },
  // modules/translator.js
  unsupportedLanguageCode: {
    en: 'Unsupported language code. It must be one of these:',
    pt: 'Código da língua não-suportado. Use um destes:'
  },
  // unlock-account
  unlockAccount: { en: 'Unlock Account', pt: 'Desbloquear Conta', hasDomNode: true },
  accountUnlockedSuccessfully: { en: 'Account unlocked successfully', pt: 'Conta desbloqueada com sucesso' },
  unlockAccountError: { en: 'Error unlocking account', pt: 'Erro ao desbloquear conta' },
  accountOrUserPubkeyNotFound: { en: 'Account or user public key not found', pt: 'Conta ou chave pública não encontrada' },
  authenticationFailed: { en: 'Authentication failed', pt: 'Falha na autenticação' },
  userPubkeyNotProvided: { en: 'User public key not provided', pt: 'Chave pública do usuário não fornecida' },
  accountNotFound: { en: 'Account not found', pt: 'Conta não encontrada' }
}

const t = ({ l = config.lang, key }) => locales[key][l] ?? `${l}.${key}`
const getDomTranslationAttributes = key => locales[key].domAttributes ?? ['innerText']

function initTranslation () {
  translateTo(config.lang)
}

const domLocaleEntries = Object.entries(locales).filter(([, v]) => v.hasDomNode).map(([k]) => [`t-${toKebabCase(k)}`, k])
function translateTo (l) {
  if (!languages[l]) throw new Error(`${t({ key: 'unsupportedLanguageCode' })} ${Object.keys(languages).join(', ')}.`)
  config.lang = l

  domLocaleEntries.forEach(([nodeClass, key]) => {
    [...document.getElementsByClassName(nodeClass)]
      .forEach(node => {
        getDomTranslationAttributes(key).forEach(domAttr => {
          node[domAttr] = t({ l, key })
        })
      })
  })
}

export {
  initTranslation,
  translateTo,
  t
}
