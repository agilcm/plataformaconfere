interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon-only' | 'stacked';
  theme?: 'dark' | 'light';
  className?: string;
}

// Logo oficial da Ágil CM (public/brand). Em fundos escuros usamos a versão
// com o grafite em branco e o azul clareado para manter o contraste.
export default function BrandLogo({ size = 'md', variant = 'full', theme = 'dark', className = '' }: BrandLogoProps) {
  const suffix = theme === 'dark' ? '-branco' : '';

  if (variant === 'stacked') {
    const h = { sm: 'h-16', md: 'h-24', lg: 'h-32' }[size];
    return (
      <img
        src={`/brand/logo-completo${suffix}.png`}
        alt="Ágil CM Soluções Integradas"
        className={`${h} w-auto select-none ${className}`}
        width={600}
        height={531}
      />
    );
  }

  const emblem = { sm: 'h-8', md: 'h-11', lg: 'h-16' }[size];
  const word = { sm: 'h-6', md: 'h-8', lg: 'h-12' }[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img
        src={`/brand/logo-emblema${suffix}.png`}
        alt={variant === 'icon-only' ? 'Ágil CM' : ''}
        aria-hidden={variant === 'icon-only' ? undefined : true}
        className={`${emblem} w-auto shrink-0`}
        width={121}
        height={120}
      />
      {variant === 'full' && (
        <img
          src={`/brand/logo-texto${suffix}.png`}
          alt="Ágil CM Soluções Integradas"
          className={`${word} w-auto`}
          width={480}
          height={140}
        />
      )}
    </div>
  );
}
