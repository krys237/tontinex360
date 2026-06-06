import jwt
import json
import requests
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


class JitsiManager:
    """
    Gestionnaire pour les sessions Jitsi.
    Gère la génération de tokens JWT, la création de salles de conférence,
    et le suivi des participants.
    """

    @staticmethod
    def get_jitsi_config():
        """Retourner la configuration Jitsi"""
        return settings.JITSI_CONFIG

    @staticmethod
    def generate_jitsi_token(room_id, user_id, user_name, email=None, affiliation=None):
        """
        Générer un token JWT pour accès Jitsi avec authentification.
        
        Args:
            room_id: ID de la salle de conférence
            user_id: ID de l'utilisateur
            user_name: Nom de l'utilisateur
            email: Email optionnel
            affiliation: Affiliation optionnelle (owner, member, none)
        
        Returns:
            Token JWT ou None si authentification désactivée
        """
        try:
            config = JitsiManager.get_jitsi_config()
            
            # Si l'authentification Jitsi n'est pas activée, retourner None
            if not config.get('ENABLE_AUTH'):
                return None

            api_key = config.get('API_KEY')
            api_secret = config.get('API_SECRET')
            
            if not api_key or not api_secret:
                logger.warning("Jitsi API credentials not configured")
                return None

            # Préparer le payload du token
            now = timezone.now()
            exp = now + timedelta(hours=1)
            
            payload = {
                'aud': 'jitsi',
                'iss': api_key,
                'sub': config.get('SERVER'),
                'room': room_id,
                'exp': int(exp.timestamp()),
                'iat': int(now.timestamp()),
                'nbf': int(now.timestamp()),
                'user': {
                    'id': str(user_id),
                    'name': user_name,
                    'email': email or '',
                    'affiliation': affiliation or 'member',
                },
                'context': {
                    'user': {
                        'id': str(user_id),
                        'name': user_name,
                        'email': email or '',
                        'avatar': '',
                    }
                }
            }

            # Générer le token
            token = jwt.encode(
                payload,
                api_secret,
                algorithm=config.get('JWT_ALGORITHM', 'HS256')
            )

            return token

        except Exception as e:
            logger.error(f"Error generating Jitsi token: {str(e)}")
            return None

    @staticmethod
    def get_jitsi_url(room_id, user_id, user_name, email=None, affiliation=None):
        """
        Obtenir l'URL complète de Jitsi pour une conférence.
        
        Args:
            room_id: ID de la salle de conférence
            user_id: ID de l'utilisateur
            user_name: Nom de l'utilisateur
            email: Email optionnel
            affiliation: Affiliation optionnelle
        
        Returns:
            URL Jitsi complète
        """
        try:
            config = JitsiManager.get_jitsi_config()
            url_prefix = config.get('URL_PREFIX', 'https://meet.jit.si')
            
            # Construire l'URL de base
            url = f"{url_prefix}/{room_id}"
            
            # Ajouter le token si authentification activée
            token = JitsiManager.generate_jitsi_token(
                room_id, user_id, user_name, email, affiliation
            )
            
            if token:
                url += f"?jwt={token}"
            
            # Ajouter les paramètres optionnels
            params = {
                'userInfo.displayName': user_name,
                'userInfo.email': email or '',
            }
            
            # Construire la chaîne de paramètres
            param_str = '&'.join([f"{k}={v}" for k, v in params.items() if v])
            
            if '?' in url:
                url += f"&{param_str}"
            else:
                url += f"?{param_str}"
            
            return url

        except Exception as e:
            logger.error(f"Error generating Jitsi URL: {str(e)}")
            return None

    @staticmethod
    def sanitize_room_id(conversation_id, timestamp=None):
        """
        Générer un ID de salle Jitsi valide à partir d'un ID de conversation.
        
        Format: tontine_<conversation_id>_<timestamp>
        
        Args:
            conversation_id: ID de la conversation
            timestamp: Timestamp optionnel (défaut: maintenant)
        
        Returns:
            ID de salle valide
        """
        try:
            # Utiliser le timestamp courant si non fourni
            if timestamp is None:
                timestamp = int(timezone.now().timestamp() * 1000)
            
            # Nettoyer l'ID de conversation
            conv_id_clean = str(conversation_id).replace('-', '')[:20]
            
            # Créer l'ID de salle (doit être alphanumérique et underscores)
            room_id = f"tontine_{conv_id_clean}_{timestamp}"
            
            # Jitsi accepte les alphanumériques, tirets, et underscores
            # Remplacer les caractères invalides
            room_id = ''.join(c if c.isalnum() or c in '-_' else '' for c in room_id)
            
            return room_id.lower()

        except Exception as e:
            logger.error(f"Error sanitizing room ID: {str(e)}")
            return None

    @staticmethod
    def create_jitsi_session_data(conversation_id, user_id, user_name, email=None):
        """
        Créer les données nécessaires pour démarrer une session Jitsi.
        
        Returns:
            Dict avec les informations de session
        """
        try:
            room_id = JitsiManager.sanitize_room_id(conversation_id)
            jitsi_url = JitsiManager.get_jitsi_url(room_id, user_id, user_name, email)
            
            session_data = {
                'room_id': room_id,
                'jitsi_url': jitsi_url,
                'config': {
                    'server': JitsiManager.get_jitsi_config().get('SERVER'),
                    'enable_auth': JitsiManager.get_jitsi_config().get('ENABLE_AUTH'),
                },
                'created_at': timezone.now().isoformat(),
                'expires_at': (timezone.now() + timedelta(hours=1)).isoformat(),
            }
            
            return session_data

        except Exception as e:
            logger.error(f"Error creating Jitsi session data: {str(e)}")
            return None
