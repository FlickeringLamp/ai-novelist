import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const CombinedIcon = ({ baseIcon, overlayIcon, size = '1x' }) => {
    return (
        <span className="relative inline-flex items-center justify-center leading-none" style={{ fontSize: size }}>
            <FontAwesomeIcon icon={baseIcon} className="relative z-0" />
            {overlayIcon && <FontAwesomeIcon icon={overlayIcon} className="absolute z-10 text-[0.6em]" />}
        </span>
    );
};

export default CombinedIcon;
