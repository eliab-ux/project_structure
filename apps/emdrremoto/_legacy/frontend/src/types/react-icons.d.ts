import { ComponentType, SVGAttributes } from 'react';

type IconComponent = ComponentType<SVGAttributes<SVGElement>> & {
  displayName?: string;
};

declare module 'react-icons/fa' {
  const content: {
    [key: string]: IconComponent;
  };
  export = content;
}

declare module 'react-icons/fi' {
  const content: {
    [key: string]: IconComponent;
  };
  export = content;
}

declare module 'react-icons/si' {
  const content: {
    [key: string]: IconComponent;
  };
  export = content;
}
