// Domain catalog: the services you can pin on a node, and the device types
// you can drop on the canvas. This file is the one you edit when a lecture
// needs a box or a role that isn't here yet.

export const SERVICE_GROUPS = {
  identity: { label: 'Identity & directory', color: '#6366f1' },
  naming:   { label: 'Naming & addressing', color: '#0284c7' },
  files:    { label: 'Files & storage',      color: '#b45309' },
  security: { label: 'Security',             color: '#dc2626' },
  app:      { label: 'Apps & web',           color: '#7c3aed' },
  comms:    { label: 'Communications',       color: '#059669' },
  ops:      { label: 'Ops & management',     color: '#475569' },
  virt:     { label: 'Virtualisation',       color: '#0891b2' },
};

// short = what gets drawn on the badge. Keep it <= 6 characters.
const SERVICE_LIST = [
  // identity
  ['adds',      'AD DS',    'Active Directory Domain Services', 'identity'],
  ['rodc',      'RODC',     'Read-only domain controller',      'identity'],
  ['ldap',      'LDAP',     'LDAP directory',                   'identity'],
  ['kerberos',  'KDC',      'Kerberos KDC',                     'identity'],
  ['adfs',      'ADFS',     'Federation service',               'identity'],
  ['entra',     'ENTRA',    'Entra ID / cloud directory',       'identity'],
  ['sso',       'SSO',      'Single sign-on',                   'identity'],
  ['mfa',       'MFA',      'Multi-factor authentication',      'identity'],
  ['gpo',       'GPO',      'Group Policy',                     'identity'],

  // naming & addressing
  ['dns',       'DNS',      'DNS resolver / authoritative',     'naming'],
  ['dnssec',    'DNSSEC',   'DNSSEC signing',                   'naming'],
  ['dhcp',      'DHCP',     'DHCP server',                      'naming'],
  ['gateway',   'GW',       'Default gateway',                  'naming'],
  ['nat',       'NAT',      'NAT / PAT',                        'naming'],
  ['ntp',       'NTP',      'Time service',                     'naming'],
  ['ipam',      'IPAM',     'IP address management',            'naming'],
  ['pxe',       'PXE',      'PXE / TFTP boot',                  'naming'],
  ['routing',   'RTG',      'Dynamic routing (OSPF/BGP)',       'naming'],

  // files & storage
  ['smb',       'SMB',      'SMB / CIFS share',                 'files'],
  ['nfs',       'NFS',      'NFS export',                       'files'],
  ['dfs',       'DFS',      'DFS namespace / replication',      'files'],
  ['iscsi',     'iSCSI',    'iSCSI target',                     'files'],
  ['ftp',       'FTP',      'FTP / SFTP',                       'files'],
  ['objstore',  'S3',       'Object storage',                   'files'],
  ['backup',    'BKP',      'Backup target / agent',            'files'],
  ['snapshot',  'SNAP',     'Snapshots / versioning',           'files'],

  // security
  ['firewall',  'FW',       'Packet / stateful filtering',      'security'],
  ['ips',       'IPS',      'Intrusion prevention',             'security'],
  ['ids',       'IDS',      'Intrusion detection',              'security'],
  ['waf',       'WAF',      'Web application firewall',         'security'],
  ['proxy',     'PROXY',    'Forward proxy / content filter',   'security'],
  ['revproxy',  'RPROXY',   'Reverse proxy',                    'security'],
  ['vpn',       'VPN',      'VPN termination',                  'security'],
  ['ipsec',     'IPSEC',    'IPsec site-to-site',               'security'],
  ['sslvpn',    'SSLVPN',   'Client SSL/TLS VPN',               'security'],
  ['pki',       'CA',       'Certificate authority / PKI',      'security'],
  ['radius',    'RADIUS',   'RADIUS / NPS',                     'security'],
  ['nac',       'NAC',      'Network access control / 802.1X',  'security'],
  ['siem',      'SIEM',     'SIEM correlation',                 'security'],
  ['av',        'AV',       'Anti-malware',                     'security'],
  ['dlp',       'DLP',      'Data loss prevention',             'security'],
  ['spam',      'SPAM',     'Mail filtering',                   'security'],

  // apps & web
  ['web',       'HTTP',     'Web server',                       'app'],
  ['db',        'SQL',      'Database',                         'app'],
  ['api',       'API',      'API endpoint',                     'app'],
  ['app',       'APP',      'Application server',               'app'],
  ['print',     'PRINT',    'Print service',                    'app'],
  ['lb',        'LB',       'Load balancing',                   'app'],

  // communications
  ['mail',      'SMTP',     'Mail transfer',                    'comms'],
  ['imap',      'IMAP',     'Mailbox access',                   'comms'],
  ['sip',       'SIP',      'VoIP signalling',                  'comms'],
  ['pbx',       'PBX',      'Telephony switching',              'comms'],
  ['mqtt',      'MQTT',     'IoT message broker',               'comms'],

  // ops & management
  ['ssh',       'SSH',      'SSH access',                       'ops'],
  ['rdp',       'RDP',      'Remote desktop',                   'ops'],
  ['winrm',     'WINRM',    'WinRM / PowerShell remoting',      'ops'],
  ['snmp',      'SNMP',     'SNMP polling',                     'ops'],
  ['syslog',    'SYSLOG',   'Syslog collection',                'ops'],
  ['monitor',   'MON',      'Monitoring / alerting',            'ops'],
  ['patch',     'PATCH',    'Patch / update distribution',      'ops'],
  ['config',    'CFG',      'Configuration management',         'ops'],
  ['netflow',   'FLOW',     'NetFlow / sFlow export',           'ops'],
  ['tacacs',    'TACACS',   'TACACS+ device auth',              'ops'],

  // virtualisation
  ['esxi',      'ESXi',     'VMware hypervisor',                'virt'],
  ['hyperv',    'HYPERV',   'Hyper-V hypervisor',               'virt'],
  ['proxmox',   'PVE',      'Proxmox VE',                       'virt'],
  ['docker',    'DOCKER',   'Container runtime',                'virt'],
  ['k8s',       'K8S',      'Kubernetes',                       'virt'],
  ['vdi',       'VDI',      'Virtual desktops',                 'virt'],
];

export const SERVICES = {};
for (const [id, short, label, group] of SERVICE_LIST) {
  SERVICES[id] = { id, short, label, group, color: SERVICE_GROUPS[group].color };
}

export const DEVICE_CATEGORIES = [
  { id: 'network',   label: 'Network' },
  { id: 'security',  label: 'Security' },
  { id: 'servers',   label: 'Servers & roles' },
  { id: 'storage',   label: 'Storage' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'wan',       label: 'Internet & cloud' },
  { id: 'misc',      label: 'Other' },
];

// [id, label, category, iconKey, accent, defaultServices, defaultSublabel]
const DEVICE_LIST = [
  // ---- network ----
  ['router',       'Router',              'network', 'router',      '#0ea5e9', ['gateway', 'nat', 'routing']],
  ['switch-l2',    'Switch (L2)',         'network', 'switch',      '#0f766e', []],
  ['switch-l3',    'Switch (L3)',         'network', 'switchL3',    '#0f766e', ['gateway', 'routing']],
  ['switch-core',  'Core switch',         'network', 'switchCore',  '#155e75', ['gateway', 'routing']],
  ['switch-poe',   'PoE switch',          'network', 'switchPoe',   '#0f766e', []],
  ['hub',          'Hub',                 'network', 'hub',         '#78716c', []],
  ['ap',           'Wireless AP',         'network', 'ap',          '#0891b2', []],
  ['wlc',          'WLAN controller',     'network', 'wlc',         '#0891b2', ['radius']],
  ['loadbalancer', 'Load balancer',       'network', 'lb',          '#7c3aed', ['lb', 'revproxy']],
  ['modem',        'Modem / ONT',         'network', 'modem',       '#64748b', []],
  ['patchpanel',   'Patch panel',         'network', 'patch',       '#94a3b8', []],

  // ---- security ----
  ['firewall',     'Firewall',            'security', 'firewall',   '#dc2626', ['firewall', 'nat']],
  ['ngfw',         'NGFW / UTM',          'security', 'ngfw',       '#b91c1c', ['firewall', 'ips', 'vpn', 'proxy']],
  ['fw-oss',       'pfSense / OPNsense',  'security', 'firewallOss','#dc2626', ['firewall', 'nat', 'vpn', 'dhcp']],
  ['ids',          'IDS / IPS sensor',    'security', 'ids',        '#dc2626', ['ids', 'ips']],
  ['waf',          'WAF',                 'security', 'waf',        '#dc2626', ['waf', 'revproxy']],
  ['proxy',        'Proxy / web filter',  'security', 'proxy',      '#dc2626', ['proxy', 'av']],
  ['vpn-gw',       'VPN gateway',         'security', 'vpn',        '#7c3aed', ['vpn', 'ipsec', 'sslvpn']],
  ['siem',         'SIEM / log collector','security', 'siem',       '#dc2626', ['siem', 'syslog']],
  ['nac',          'NAC / 802.1X',        'security', 'nac',        '#dc2626', ['nac', 'radius']],
  ['ca',           'Certificate authority','security','ca',         '#dc2626', ['pki']],
  ['bastion',      'Jump host / bastion', 'security', 'bastion',    '#dc2626', ['ssh', 'rdp', 'mfa']],

  // ---- servers & roles ----
  ['server',       'Server (generic)',    'servers', 'server',      '#475569', []],
  ['win-server',   'Windows Server',      'servers', 'winServer',   '#2563eb', ['winrm']],
  ['linux-server', 'Linux server',        'servers', 'linuxServer', '#111827', ['ssh']],
  ['dc',           'Domain controller',   'servers', 'dc',          '#4f46e5', ['adds', 'dns', 'ldap', 'kerberos', 'gpo']],
  ['rodc',         'Read-only DC',        'servers', 'rodc',        '#4f46e5', ['rodc', 'dns', 'ldap']],
  ['dns-server',   'DNS server',          'servers', 'dns',         '#0284c7', ['dns']],
  ['dhcp-server',  'DHCP server',         'servers', 'dhcp',        '#0284c7', ['dhcp']],
  ['file-server',  'File server (Linux)', 'servers', 'fileServer',  '#b45309', ['smb', 'nfs', 'ssh']],
  ['file-server-w','File server (Windows)','servers','fileServerWin','#b45309',['smb', 'dfs']],
  ['web-server',   'Web server',          'servers', 'web',         '#7c3aed', ['web']],
  ['db-server',    'Database server',     'servers', 'db',          '#7c3aed', ['db']],
  ['mail-server',  'Mail server',         'servers', 'mail',        '#059669', ['mail', 'imap', 'spam']],
  ['app-server',   'Application server',  'servers', 'app',         '#7c3aed', ['app', 'api']],
  ['print-server', 'Print server',        'servers', 'printServer', '#7c3aed', ['print']],
  ['backup-server','Backup server',       'servers', 'backup',      '#b45309', ['backup']],
  ['monitoring',   'Monitoring server',   'servers', 'monitor',     '#475569', ['monitor', 'snmp', 'syslog']],
  ['update-server','Patch / update server','servers','update',      '#475569', ['patch']],
  ['radius-server','RADIUS / NPS',        'servers', 'radius',      '#dc2626', ['radius']],
  ['hypervisor',   'Hypervisor host',     'servers', 'hypervisor',  '#0891b2', ['esxi']],
  ['container',    'Container host',      'servers', 'container',   '#0891b2', ['docker']],
  ['k8s',          'Kubernetes cluster',  'servers', 'k8s',         '#0891b2', ['k8s', 'api']],
  ['pbx',          'VoIP PBX',            'servers', 'pbx',         '#059669', ['sip', 'pbx']],
  ['rack',         'Server rack',         'servers', 'rack',        '#475569', []],

  // ---- storage ----
  ['nas',          'NAS',                 'storage', 'nas',         '#b45309', ['smb', 'nfs']],
  ['san',          'SAN array',           'storage', 'san',         '#b45309', ['iscsi']],
  ['tape',         'Tape library',        'storage', 'tape',        '#b45309', ['backup']],

  // ---- endpoints ----
  ['pc',           'Desktop PC',          'endpoints', 'pc',        '#334155', []],
  ['laptop',       'Laptop',              'endpoints', 'laptop',    '#334155', []],
  ['thinclient',   'Thin client',         'endpoints', 'thin',      '#334155', ['vdi']],
  ['mobile',       'Mobile device',       'endpoints', 'mobile',    '#334155', []],
  ['ipphone',      'IP phone',            'endpoints', 'ipphone',   '#059669', ['sip']],
  ['printer',      'Printer / MFP',       'endpoints', 'printer',   '#334155', []],
  ['camera',       'IP camera',           'endpoints', 'camera',    '#334155', []],
  ['iot',          'IoT device',          'endpoints', 'iot',       '#334155', ['mqtt']],
  ['user',         'User',                'endpoints', 'user',      '#334155', []],

  // ---- internet & cloud ----
  ['internet',     'Internet',            'wan', 'internet',        '#0ea5e9', []],
  ['cloud',        'Cloud (generic)',     'wan', 'cloud',           '#0ea5e9', []],
  ['isp',          'ISP / carrier',       'wan', 'isp',             '#0ea5e9', []],
  ['mpls',         'MPLS / WAN',          'wan', 'mpls',            '#0ea5e9', ['routing']],
  ['saas',         'SaaS service',        'wan', 'saas',            '#7c3aed', ['web', 'sso']],
  ['publiccloud',  'Public cloud',        'wan', 'publicCloud',     '#2563eb', ['api']],
  ['lte',          '4G / 5G link',        'wan', 'lte',             '#0ea5e9', []],
  ['satellite',    'Satellite link',      'wan', 'satellite',       '#0ea5e9', []],

  // ---- other ----
  ['generic',      'Generic device',      'misc', 'box',            '#64748b', []],
  ['ups',          'UPS',                 'misc', 'ups',            '#64748b', []],
];

export const DEVICES = {};
for (const [id, label, category, icon, accent, services] of DEVICE_LIST) {
  DEVICES[id] = { id, label, category, icon, accent, services };
}

export const LINK_KINDS = {
  lan:      { id: 'lan',      label: 'Ethernet / LAN',   color: '#475569', width: 2,   dash: null },
  trunk:    { id: 'trunk',    label: '802.1Q trunk',     color: '#1e293b', width: 3.4, dash: null },
  fiber:    { id: 'fiber',    label: 'Fibre uplink',     color: '#f59e0b', width: 2.6, dash: null },
  wan:      { id: 'wan',      label: 'WAN / Internet',   color: '#0ea5e9', width: 3,   dash: null },
  wireless: { id: 'wireless', label: 'Wireless',         color: '#0891b2', width: 2,   dash: '2 5' },
  vpn:      { id: 'vpn',      label: 'VPN tunnel',       color: '#7c3aed', width: 2.6, dash: '9 5' },
  serial:   { id: 'serial',   label: 'Serial / leased',  color: '#78716c', width: 2,   dash: '10 4 2 4' },
  logical:  { id: 'logical',  label: 'Logical relation', color: '#94a3b8', width: 1.6, dash: '3 4' },
};

export const ZONE_COLORS = [
  { id: 'slate',  label: 'Site',      color: '#64748b' },
  { id: 'blue',   label: 'LAN',       color: '#2563eb' },
  { id: 'green',  label: 'Trusted',   color: '#059669' },
  { id: 'amber',  label: 'DMZ',       color: '#d97706' },
  { id: 'red',    label: 'Untrusted', color: '#dc2626' },
  { id: 'violet', label: 'Cloud',     color: '#7c3aed' },
];

export function deviceOrDefault(type) {
  return DEVICES[type] || DEVICES.generic;
}
