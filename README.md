The Secure Login is what fuels the 44billion.net and all its umbrella apps' login.

By loading it directly from Github (a different domain),
44billion.net is unable to access your private keys
because of browser's cross-domain security policies.

The code is not only open-source but also is guaranteed to be the same
loaded by 44billion.net. You can inspect that 44billion.net loads it
using a sandboxed iframe that points to Github, which automatically serves code
from this repository, as any Github Pages website.

For even more security, fork it under your Github user or host it on your own server.
Then go to 44billion.net login page and configure it to load the Secure Login from the new URL.
Don't forget to keep your fork up-to-date after reviewing new commits.
